'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/providers/auth.provider';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface Audit {
    id: string;
    lcp: number;
    fid: number;
    cls: number;
    seoScore: number;
    createdAt: string;
}

interface ProjectAnalyticsProps {
    projectId: string;
    projectName: string;
    deployUrl?: string; // pre-filled URL for audit
}

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
    const radius = 28;
    const circ = 2 * Math.PI * radius;
    const pct = Math.min(Math.max(score, 0), 100) / 100;
    return (
        <div className="flex flex-col items-center gap-1.5">
            <div className="relative w-16 h-16">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
                    <circle
                        cx="32" cy="32" r={radius} fill="none"
                        stroke={color} strokeWidth="5"
                        strokeDasharray={circ}
                        strokeDashoffset={circ * (1 - pct)}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                    />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                    {score}
                </span>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</span>
        </div>
    );
}

function MetricCard({ label, value, unit, color, description }: {
    label: string; value: number | null; unit: string; color: string; description: string;
}) {
    return (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</span>
            <span className={`text-2xl font-bold font-mono ${color}`}>
                {value != null ? `${value.toFixed(2)}${unit}` : '—'}
            </span>
            <span className="text-[11px] text-gray-600">{description}</span>
        </div>
    );
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-gray-900 border border-white/10 p-3 rounded-xl shadow-2xl text-xs">
            <p className="text-gray-400 mb-2">{new Date(label).toLocaleString()}</p>
            {payload.map((entry: any, i: number) => (
                <div key={i} className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
                    <span className="text-gray-300">{entry.name}:</span>
                    <span className="font-mono text-white font-semibold">{entry.value?.toFixed(2)}</span>
                </div>
            ))}
        </div>
    );
};

export default function ProjectAnalytics({ projectId, projectName, deployUrl }: ProjectAnalyticsProps) {
    const { token } = useAuth();
    const [audits, setAudits] = useState<Audit[]>([]);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [auditUrl, setAuditUrl] = useState(deployUrl || '');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const latest = audits[audits.length - 1] ?? null;

    const fetchAudits = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch(`/api/analytics/performance?projectId=${projectId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok) setAudits(data.audits ?? []);
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, [token, projectId]);

    useEffect(() => { fetchAudits(); }, [fetchAudits]);

    const runAudit = async () => {
        if (!auditUrl.trim() || !token) return;
        setError('');
        setSuccess('');

        // Normalise: auto-prepend https:// if missing
        let normalised = auditUrl.trim();
        if (!/^https?:\/\//i.test(normalised)) normalised = `https://${normalised}`;

        // Validate it's a real URL
        try { new URL(normalised); } catch {
            setError('Please enter a valid URL, e.g. https://yourdomain.com');
            return;
        }

        // Update the input field with the normalised value
        setAuditUrl(normalised);
        setRunning(true);
        try {
            const res = await fetch('/api/analytics/performance', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, url: normalised }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Audit failed');
            setSuccess('Audit complete!');
            await fetchAudits();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setRunning(false);
        }
    };

    const formatTime = (t: string) => {
        const d = new Date(t);
        return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    if (loading) return (
        <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="space-y-5">
            {/* Run Audit bar */}
            <div className="space-y-1.5">
                <div className="flex gap-2 flex-wrap">
                    <input
                        value={auditUrl}
                        onChange={e => { setAuditUrl(e.target.value); setError(''); }}
                        onKeyDown={e => e.key === 'Enter' && runAudit()}
                        placeholder="https://yourdomain.com"
                        className="flex-1 min-w-0 bg-gray-900/80 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50"
                    />
                    <button
                        onClick={runAudit}
                        disabled={running || !auditUrl.trim()}
                        className="px-5 py-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 text-sm font-semibold hover:bg-blue-600/30 hover:border-blue-400/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
                    >
                        {running ? (
                            <><div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />Running...</>
                        ) : (
                            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>Run Audit</>
                        )}
                    </button>
                </div>
                <p className="text-[11px] text-gray-600">Enter the live URL of your deployed app. <code className="font-mono">https://</code> is added automatically.</p>
            </div>

            {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
            {success && <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">✓ {success}</p>}

            {audits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 border border-dashed border-white/[0.06] rounded-2xl text-center gap-3">
                    <svg className="w-10 h-10 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-sm text-gray-500">No audits yet for <span className="text-white font-medium">{projectName}</span></p>
                    <p className="text-xs text-gray-600">Enter a URL above and click Run Audit to get your first Core Web Vitals report.</p>
                </div>
            ) : (
                <>
                    {/* SEO Score ring + CWV metric cards */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex items-center justify-center sm:justify-start gap-6 bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
                            <ScoreRing
                                score={latest?.seoScore ?? 0}
                                label="SEO Score"
                                color={latest && latest.seoScore >= 80 ? '#10b981' : latest && latest.seoScore >= 50 ? '#f59e0b' : '#ef4444'}
                            />
                            <div>
                                <p className="text-xs text-gray-500 mb-0.5">Last audit</p>
                                <p className="text-sm font-semibold text-white">{latest ? formatTime(latest.createdAt) : '—'}</p>
                                <p className="text-[11px] text-gray-600 mt-1">{audits.length} audit{audits.length !== 1 ? 's' : ''} recorded</p>
                            </div>
                        </div>

                        <div className="flex-1 grid grid-cols-3 gap-3">
                            <MetricCard label="LCP" value={latest?.lcp ?? null} unit="s" color="text-violet-400" description="Largest Contentful Paint" />
                            <MetricCard label="FID" value={latest?.fid ?? null} unit="ms" color="text-blue-400" description="First Input Delay" />
                            <MetricCard label="CLS" value={latest?.cls ?? null} unit="" color="text-emerald-400" description="Cumulative Layout Shift" />
                        </div>
                    </div>

                    {/* Trend Chart */}
                    {audits.length > 1 && (
                        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Core Web Vitals — Trend</p>
                            <div className="h-52 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={audits} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                        <XAxis dataKey="createdAt" tickFormatter={formatTime} stroke="#374151" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={40} />
                                        <YAxis stroke="#374151" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#374151', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} iconType="circle" />
                                        <Line type="monotone" dataKey="lcp" name="LCP (s)" stroke="#8b5cf6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                                        <Line type="monotone" dataKey="fid" name="FID (ms)" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                                        <Line type="monotone" dataKey="cls" name="CLS" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* SEO Score trend */}
                    {audits.length > 1 && (
                        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">SEO Score — Trend</p>
                            <div className="h-36 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={audits} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                        <XAxis dataKey="createdAt" tickFormatter={formatTime} stroke="#374151" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={40} />
                                        <YAxis stroke="#374151" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#374151', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                        <Line type="monotone" dataKey="seoScore" name="SEO Score" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
