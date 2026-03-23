'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/providers/auth.provider';

interface EnvEntry {
    key: string;
    value: string;
    masked: boolean;
}

interface Row {
    key: string;
    value: string;
    isNew?: boolean;
}

interface ProjectEnvEditorProps {
    projectId: string;
    projectName: string;
    isOpen: boolean;
    onClose: () => void;
}

export default function ProjectEnvEditor({ projectId, projectName, isOpen, onClose }: ProjectEnvEditorProps) {
    const { token } = useAuth();
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());

    const fetchEnv = useCallback(async () => {
        if (!token || !isOpen) return;
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/projects/${projectId}/env`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to load');
            const data = await res.json();
            const entries: EnvEntry[] = data.entries ?? [];
            setRows(entries.length > 0
                ? entries.map(e => ({ key: e.key, value: e.value }))
                : [{ key: '', value: '' }]
            );
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [token, projectId, isOpen]);

    useEffect(() => { fetchEnv(); }, [fetchEnv]);

    // Reset on close
    useEffect(() => { if (!isOpen) { setRevealedKeys(new Set()); setSaved(false); setError(''); } }, [isOpen]);

    const addRow = () => setRows(r => [...r, { key: '', value: '', isNew: true }]);

    const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i));

    const updateRow = (i: number, field: 'key' | 'value', val: string) =>
        setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

    const handleSave = async () => {
        setSaving(true); setError(''); setSaved(false);
        try {
            // Validate no duplicate or empty keys
            const keys = rows.map(r => r.key.trim()).filter(Boolean);
            if (new Set(keys).size !== keys.length) throw new Error('Duplicate keys found');

            const env: Record<string, string> = {};
            for (const row of rows) {
                const k = row.key.trim();
                if (!k) continue;
                env[k] = row.value;
            }

            const res = await fetch(`/api/projects/${projectId}/env`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ env }),
            });
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to save');
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const text = e.clipboardData.getData('text');
        const isBulk = text.includes('\\n') && text.includes('=');
        const isSingleAssignment = /^[A-Z_][A-Z0-9_]*\\s*=/.test(text.trim());
        
        if (!isBulk && !isSingleAssignment) return; // Let default browser paste happen!
        e.preventDefault();
        const parsed: Row[] = [];
        for (const line of text.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eq = trimmed.indexOf('=');
            if (eq < 1) continue;
            const key = trimmed.slice(0, eq).trim();
            const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
            parsed.push({ key, value });
        }
        if (parsed.length > 0) setRows(prev => {
            const existing = prev.filter(r => r.key.trim());
            const merged = [...existing];
            for (const p of parsed) {
                const idx = merged.findIndex(r => r.key === p.key);
                if (idx >= 0) merged[idx] = p;
                else merged.push(p);
            }
            return merged;
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-gray-950 border border-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-shrink-0">
                    <div>
                        <h2 className="text-white font-semibold text-base">Environment Variables</h2>
                        <p className="text-gray-500 text-xs mt-0.5">{projectName}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Paste hint */}
                <div className="px-5 pt-3 pb-1 flex-shrink-0">
                    <p className="text-xs text-gray-600">
                        💡 You can paste a <code className="text-gray-500">.env</code> file directly into any value field to bulk-import variables.
                    </p>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-12 text-gray-500">
                            <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            Loading...
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {/* Column labels */}
                            <div className="grid grid-cols-[1fr_1fr_32px] gap-2 px-1 mb-1">
                                <span className="text-xs text-gray-600 uppercase tracking-wider">Key</span>
                                <span className="text-xs text-gray-600 uppercase tracking-wider">Value</span>
                                <span />
                            </div>

                            {rows.map((row, i) => (
                                <div key={i} className="grid grid-cols-[1fr_1fr_32px] gap-2 items-center group">
                                    <input
                                        value={row.key}
                                        onChange={e => updateRow(i, 'key', e.target.value)}
                                        placeholder="VARIABLE_NAME"
                                        className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-gray-700 focus:outline-none focus:border-blue-600 transition-colors"
                                        spellCheck={false}
                                        autoCapitalize="characters"
                                    />
                                    <div className="relative">
                                        <textarea
                                            value={revealedKeys.has(row.key) ? row.value : row.value}
                                            onChange={e => updateRow(i, 'value', e.target.value)}
                                            onPaste={handlePaste}
                                            placeholder="value"
                                            rows={1}
                                            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-gray-700 focus:outline-none focus:border-blue-600 transition-colors resize-none overflow-hidden"
                                            style={{ minHeight: '38px' }}
                                            onInput={e => {
                                                const el = e.currentTarget;
                                                el.style.height = 'auto';
                                                el.style.height = `${el.scrollHeight}px`;
                                            }}
                                            spellCheck={false}
                                        />
                                    </div>
                                    <button
                                        onClick={() => removeRow(i)}
                                        className="text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                                        title="Remove"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            ))}

                            <button
                                onClick={addRow}
                                className="mt-2 flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors py-1"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add variable
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-gray-800 flex items-center justify-between gap-3 flex-shrink-0">
                    <div className="flex-1">
                        {error && (
                            <p className="text-red-400 text-sm flex items-center gap-1.5">
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {error}
                            </p>
                        )}
                        {saved && (
                            <p className="text-green-400 text-sm flex items-center gap-1.5">
                                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Saved! Changes will apply on next deploy.
                            </p>
                        )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || loading}
                            className="px-5 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {saving && (
                                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                            )}
                            {saving ? 'Saving...' : 'Save Variables'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
