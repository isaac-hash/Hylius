'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/auth.provider';

interface Server {
    id: string;
    name: string;
    ip: string;
}

interface Project {
    id: string;
    name: string;
    deployStrategy: string | null;
    serverId: string;
    stackId?: string | null;
}

interface Database {
    id: string;
    name: string;
    engine: string;
    status: string;
    serverId: string;
    stackId?: string | null;
}

interface CreateStackModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated?: (stackId: string) => void;
}

const STEPS = ['info', 'services', 'databases', 'review'] as const;
type Step = typeof STEPS[number];

const STEP_LABELS: Record<Step, string> = {
    info: 'Name your app',
    services: 'What does your app need?',
    databases: 'Add a database',
    review: 'Review & Launch',
};

function getStrategyIcon(strategy: string | null) {
    switch (strategy) {
        case 'dagger': return '⚡';
        case 'docker-compose': case 'compose-server': case 'compose-registry': return '🐳';
        case 'ghcr-pull': return '📦';
        case 'railpack': case 'nixpacks': return '🏗️';
        default: return '📄';
    }
}

function getEngineIcon(engine: string) {
    switch (engine.toUpperCase()) {
        case 'POSTGRES': return '🐘';
        case 'MYSQL': return '🐬';
        case 'REDIS': return '🔴';
        default: return '💾';
    }
}

export default function CreateStackModal({ isOpen, onClose, onCreated }: CreateStackModalProps) {
    const { token } = useAuth();
    const [step, setStep] = useState<Step>('info');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Step 1: Stack info
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [serverId, setServerId] = useState('');

    // Data
    const [servers, setServers] = useState<Server[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [databases, setDatabases] = useState<Database[]>([]);

    // Selected items
    const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
    const [selectedDatabases, setSelectedDatabases] = useState<string[]>([]);

    // Fetch servers on open
    useEffect(() => {
        if (isOpen) {
            fetchServers();
        }
    }, [isOpen]);

    // Fetch projects & databases when server is selected
    useEffect(() => {
        if (serverId) {
            fetchServerResources();
        }
    }, [serverId]);

    if (!isOpen) return null;

    async function fetchServers() {
        try {
            const res = await fetch('/api/servers', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            setServers(data);
            if (data.length === 1) setServerId(data[0].id);
        } catch {
            setError('Failed to load servers');
        }
    }

    async function fetchServerResources() {
        try {
            const [projRes, dbRes] = await Promise.all([
                fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`/api/databases?serverId=${serverId}`, { headers: { Authorization: `Bearer ${token}` } }),
            ]);
            const projData = await projRes.json();
            const dbData = await dbRes.json();

            // Only show projects on the selected server that aren't already in a stack
            setProjects((projData || []).filter((p: Project) => p.serverId === serverId && !p.stackId));
            setDatabases((dbData || []).filter((d: Database) => d.serverId === serverId && !d.stackId));
        } catch {
            // Non-critical — user can still create the stack
        }
    }

    function toggleProject(id: string) {
        setSelectedProjects(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    }

    function toggleDatabase(id: string) {
        setSelectedDatabases(prev =>
            prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
        );
    }

    async function handleCreate() {
        setError('');
        setLoading(true);

        try {
            // 1. Create the stack
            const stackRes = await fetch('/api/stacks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ name, description: description || undefined, serverId }),
            });

            if (!stackRes.ok) {
                const errData = await stackRes.json();
                throw new Error(errData.error || 'Failed to create stack');
            }

            const stack = await stackRes.json();

            // 2. Add selected projects
            for (const projectId of selectedProjects) {
                await fetch(`/api/stacks/${stack.id}/services`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ projectId }),
                });
            }

            // 3. Add selected databases
            for (const databaseId of selectedDatabases) {
                await fetch(`/api/stacks/${stack.id}/databases`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ databaseId }),
                });
            }

            // Reset and close
            resetForm();
            onCreated?.(stack.id);
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setLoading(false);
        }
    }

    function resetForm() {
        setStep('info');
        setName('');
        setDescription('');
        setServerId('');
        setSelectedProjects([]);
        setSelectedDatabases([]);
        setError('');
    }

    function goNext() {
        const idx = STEPS.indexOf(step);
        if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
    }

    function goBack() {
        const idx = STEPS.indexOf(step);
        if (idx > 0) setStep(STEPS[idx - 1]);
    }

    const canProceed = () => {
        if (step === 'info') return name.trim().length > 0 && serverId.length > 0;
        return true;
    };

    const stepIndex = STEPS.indexOf(step);
    const selectedServer = servers.find(s => s.id === serverId);

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-6 pb-4 border-b border-gray-800/50">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-white">Create Stack</h2>
                            <p className="text-sm text-gray-500 mt-0.5">{STEP_LABELS[step]}</p>
                        </div>
                        <button onClick={() => { resetForm(); onClose(); }} className="text-gray-500 hover:text-white transition-colors p-1">✕</button>
                    </div>

                    {/* Step Indicator */}
                    <div className="flex gap-1.5">
                        {STEPS.map((s, i) => (
                            <div
                                key={s}
                                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                                    i <= stepIndex ? 'bg-blue-500' : 'bg-gray-800'
                                }`}
                            />
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {error && (
                        <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm p-3 rounded-lg mb-4">
                            {error}
                        </div>
                    )}

                    {/* Step 1: Info */}
                    {step === 'info' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1.5 font-medium">Stack Name <span className="text-red-400">*</span></label>
                                <input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="My SaaS App"
                                    className="w-full bg-black border border-gray-800 rounded-lg p-3 text-white text-sm placeholder-gray-600 focus:border-blue-600 focus:outline-none transition-colors"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1.5 font-medium">Description</label>
                                <input
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Frontend + API + Database (optional)"
                                    className="w-full bg-black border border-gray-800 rounded-lg p-3 text-white text-sm placeholder-gray-600 focus:border-blue-600 focus:outline-none transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1.5 font-medium">Deploy Server <span className="text-red-400">*</span></label>
                                <select
                                    value={serverId}
                                    onChange={e => setServerId(e.target.value)}
                                    className="w-full bg-black border border-gray-800 rounded-lg p-3 text-white text-sm focus:border-blue-600 focus:outline-none transition-colors"
                                >
                                    <option value="">Select a server...</option>
                                    {servers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.ip})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Services */}
                    {step === 'services' && (
                        <div className="space-y-3">
                            <p className="text-sm text-gray-500 mb-3">
                                Select existing projects on <span className="text-gray-300 font-medium">{selectedServer?.name}</span> to include in this stack. You can also add more later.
                            </p>

                            {projects.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <div className="text-3xl mb-2">📂</div>
                                    <p className="text-sm">No available projects on this server</p>
                                    <p className="text-xs text-gray-600 mt-1">Create projects first, then add them to a stack</p>
                                </div>
                            ) : (
                                projects.map(project => (
                                    <button
                                        key={project.id}
                                        type="button"
                                        onClick={() => toggleProject(project.id)}
                                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                                            selectedProjects.includes(project.id)
                                                ? 'border-blue-500/50 bg-blue-500/10'
                                                : 'border-gray-800 hover:border-gray-700 hover:bg-gray-800/30'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-lg">{getStrategyIcon(project.deployStrategy)}</span>
                                            <div className="flex-1">
                                                <span className="text-white text-sm font-medium">{project.name}</span>
                                                <span className="text-xs text-gray-600 ml-2">{project.deployStrategy || 'auto'}</span>
                                            </div>
                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                                                selectedProjects.includes(project.id)
                                                    ? 'border-blue-500 bg-blue-500'
                                                    : 'border-gray-700'
                                            }`}>
                                                {selectedProjects.includes(project.id) && (
                                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}

                            {selectedProjects.length > 0 && (
                                <div className="mt-3 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 text-center">
                                    {selectedProjects.length} service{selectedProjects.length > 1 ? 's' : ''} selected
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Databases */}
                    {step === 'databases' && (
                        <div className="space-y-3">
                            <p className="text-sm text-gray-500 mb-3">
                                Link existing databases from <span className="text-gray-300 font-medium">{selectedServer?.name}</span> to this stack. This is optional.
                            </p>

                            {databases.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <div className="text-3xl mb-2">💾</div>
                                    <p className="text-sm">No available databases on this server</p>
                                    <p className="text-xs text-gray-600 mt-1">You can provision and add databases later</p>
                                </div>
                            ) : (
                                databases.map(db => (
                                    <button
                                        key={db.id}
                                        type="button"
                                        onClick={() => toggleDatabase(db.id)}
                                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                                            selectedDatabases.includes(db.id)
                                                ? 'border-green-500/50 bg-green-500/10'
                                                : 'border-gray-800 hover:border-gray-700 hover:bg-gray-800/30'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-lg">{getEngineIcon(db.engine)}</span>
                                            <div className="flex-1">
                                                <span className="text-white text-sm font-medium">{db.name}</span>
                                                <span className="text-xs text-gray-600 ml-2">{db.engine}</span>
                                            </div>
                                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                                                db.status === 'RUNNING'
                                                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                                    : 'bg-gray-800 text-gray-500'
                                            }`}>
                                                {db.status}
                                            </span>
                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                                                selectedDatabases.includes(db.id)
                                                    ? 'border-green-500 bg-green-500'
                                                    : 'border-gray-700'
                                            }`}>
                                                {selectedDatabases.includes(db.id) && (
                                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}

                            {selectedDatabases.length > 0 && (
                                <div className="mt-3 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-center">
                                    {selectedDatabases.length} database{selectedDatabases.length > 1 ? 's' : ''} selected
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 4: Review */}
                    {step === 'review' && (
                        <div className="space-y-4">
                            <div className="bg-black/40 border border-gray-800 rounded-xl p-4 space-y-3">
                                <div>
                                    <span className="text-xs text-gray-500 uppercase tracking-wider">Stack</span>
                                    <p className="text-white font-semibold text-lg">{name}</p>
                                    {description && <p className="text-gray-500 text-sm">{description}</p>}
                                </div>

                                <div className="border-t border-gray-800 pt-3">
                                    <span className="text-xs text-gray-500 uppercase tracking-wider">Server</span>
                                    <p className="text-white text-sm font-medium">{selectedServer?.name} <span className="text-gray-600">({selectedServer?.ip})</span></p>
                                </div>

                                <div className="border-t border-gray-800 pt-3">
                                    <span className="text-xs text-gray-500 uppercase tracking-wider">Services ({selectedProjects.length})</span>
                                    {selectedProjects.length === 0 ? (
                                        <p className="text-gray-600 text-sm mt-1">No services — you can add them later</p>
                                    ) : (
                                        <div className="space-y-1 mt-1">
                                            {selectedProjects.map(id => {
                                                const p = projects.find(pr => pr.id === id);
                                                return p ? (
                                                    <div key={id} className="flex items-center gap-2 text-sm">
                                                        <span>{getStrategyIcon(p.deployStrategy)}</span>
                                                        <span className="text-gray-300">{p.name}</span>
                                                    </div>
                                                ) : null;
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className="border-t border-gray-800 pt-3">
                                    <span className="text-xs text-gray-500 uppercase tracking-wider">Databases ({selectedDatabases.length})</span>
                                    {selectedDatabases.length === 0 ? (
                                        <p className="text-gray-600 text-sm mt-1">No databases — you can add them later</p>
                                    ) : (
                                        <div className="space-y-1 mt-1">
                                            {selectedDatabases.map(id => {
                                                const d = databases.find(db => db.id === id);
                                                return d ? (
                                                    <div key={id} className="flex items-center gap-2 text-sm">
                                                        <span>{getEngineIcon(d.engine)}</span>
                                                        <span className="text-gray-300">{d.name}</span>
                                                        <span className="text-gray-600 text-xs">{d.engine}</span>
                                                    </div>
                                                ) : null;
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-800/50 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={stepIndex === 0 ? () => { resetForm(); onClose(); } : goBack}
                        className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        {stepIndex === 0 ? 'Cancel' : '← Back'}
                    </button>

                    {step === 'review' ? (
                        <button
                            onClick={handleCreate}
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Creating...
                                </span>
                            ) : (
                                '🚀 Create Stack'
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={goNext}
                            disabled={!canProceed()}
                            className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-30 border border-gray-700"
                        >
                            Continue →
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
