'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/providers/auth.provider';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const ProjectAnalytics = dynamic(() => import('@/components/ProjectAnalytics'), { ssr: false });

type Tab = 'performance' | 'traffic';
type Period = '24h' | '7d' | '30d';

interface ProjectOverview {
    project: { id: string; name: string; domains: { hostname: string }[] };
    latestAudit: { lcp: number; fid: number; cls: number; seoScore: number; createdAt: string } | null;
}

interface Server { id: string; name: string; hasTrafficAnalytics: boolean; trafficAnalyticsUrl: string | null; }

interface ProjectItem {
    id: string; name: string; serverId: string;
    trafficAnalyticsSiteId: string | null;
    domains: { hostname: string }[];
    server: Server;
}

interface AnalyticsStats {
    period: string;
    summary: { pageviews: number; visitors: number; visits: number; bounceRate: number; avgDuration: number; active: number };
    pageviews: { pageviews: { x: string; y: number }[]; sessions: { x: string; y: number }[] };
    topPages: { x: string; y: number }[];
    referrers: { x: string; y: number }[];
    browsers: { x: string; y: number }[];
    devices: { x: string; y: number }[];
    countries: { x: string; y: number }[];
}

function ScorePill({ score }: { score: number }) {
    const color = score >= 80 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        : score >= 50 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            : 'bg-red-500/10 text-red-400 border-red-500/20';
    return <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${color}`}>{score}</span>;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
    return (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">{label}</p>
            <p className="text-3xl font-bold text-white">{value}</p>
            {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
        </div>
    );
}

function MetricBar({ label, value, max }: { label: string; value: number; max: number }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 truncate flex-1 min-w-0">{label || '(direct)'}</span>
            <div className="w-24 h-1.5 bg-white/[0.04] rounded-full overflow-hidden shrink-0">
                <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm text-gray-500 w-8 text-right shrink-0">{value}</span>
        </div>
    );
}

function SparkLine({ data }: { data: { x: string; y: number }[] }) {
    if (!data.length) return null;
    const max = Math.max(...data.map(d => d.y), 1);
    const w = 120; const h = 36;
    const pts = data.map((d, i) => {
        const x = (i / (data.length - 1 || 1)) * w;
        const y = h - (d.y / max) * h;
        return `${x},${y}`;
    }).join(' ');
    return (
        <svg width={w} height={h} className="opacity-60">
            <polyline fill="none" stroke="#8b5cf6" strokeWidth="1.5" points={pts} />
        </svg>
    );
}

export default function AnalyticsPage() {
    const { token } = useAuth();
    const [tab, setTab] = useState<Tab>('performance');
    const [period, setPeriod] = useState<Period>('7d');
    const [overview, setOverview] = useState<ProjectOverview[]>([]);
    const [servers, setServers] = useState<Server[]>([]);
    const [projects, setProjects] = useState<ProjectItem[]>([]);
    const [selectedPerfId, setSelectedPerfId] = useState('');
    const [selectedTrafficId, setSelectedTrafficId] = useState('');
    const [stats, setStats] = useState<AnalyticsStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsError, setStatsError] = useState('');
    const [loading, setLoading] = useState(true);
    const [enabling, setEnabling] = useState(false);

    const fetchBase = useCallback(async () => {
        if (!token) return;
        try {
            const [perfData, serversData, projectsData] = await Promise.all([
                fetch('/api/analytics/performance', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
                fetch('/api/servers', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
                fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
            ]);
            if (Array.isArray(perfData)) { setOverview(perfData); setSelectedPerfId(p => p || perfData[0]?.project.id || ''); }
            if (Array.isArray(serversData)) setServers(serversData);
            if (Array.isArray(projectsData)) {
                setProjects(projectsData);
                const first = projectsData.find((p: ProjectItem) => p.trafficAnalyticsSiteId);
                setSelectedTrafficId(id => id || first?.id || '');
            }
        } catch { /* silent */ } finally { setLoading(false); }
    }, [token]);

    useEffect(() => { fetchBase(); }, [fetchBase]);

    const fetchStats = useCallback(async (projectId: string, p: Period) => {
        if (!token || !projectId) return;
        setStatsLoading(true); setStatsError('');
        try {
            const res = await fetch(`/api/projects/${projectId}/analytics/stats?period=${p}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) { setStatsError(data.error || 'Failed to load analytics'); setStats(null); }
            else setStats(data);
        } catch { setStatsError('Network error'); }
        finally { setStatsLoading(false); }
    }, [token]);

    useEffect(() => {
        if (tab === 'traffic' && selectedTrafficId) fetchStats(selectedTrafficId, period);
    }, [tab, selectedTrafficId, period, fetchStats]);

    const enableAnalytics = async (projectId: string) => {
        if (!token) return;
        setEnabling(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/analytics/enable`, {
                method: 'POST', headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) alert(data.error || 'Failed to enable analytics');
            else { await fetchBase(); setSelectedTrafficId(projectId); }
        } catch { alert('Network error'); } finally { setEnabling(false); }
    };

    const disableAnalytics = async (projectId: string) => {
        if (!confirm('Disable analytics for this project? Historical data will be removed from Umami.')) return;
        if (!token) return;
        try {
            await fetch(`/api/projects/${projectId}/analytics/disable`, {
                method: 'POST', headers: { Authorization: `Bearer ${token}` },
            });
            await fetchBase();
            if (selectedTrafficId === projectId) setSelectedTrafficId('');
        } catch { alert('Network error'); }
    };

    const selectedOverview = overview.find(o => o.project.id === selectedPerfId);
    const analyticsProjects = projects.filter(p => p.server?.hasTrafficAnalytics);
    const enabledProjects = analyticsProjects.filter(p => p.trafficAnalyticsSiteId);
    const selectedProject = projects.find(p => p.id === selectedTrafficId);
    const umamiServers = servers.filter(s => s.hasTrafficAnalytics);

    const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
    const fmtDur = (s: number) => s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;

    if (loading) return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-background text-foreground">
            <main className="py-6">
                <header className="mb-8 animate-reveal">
                    <h1 className="font-display text-4xl font-bold tracking-tight text-white mb-2">Analytics</h1>
                    <p className="text-gray-400 max-w-2xl">Monitor performance, SEO scores, and traffic across your projects.</p>
                </header>

                {/* Tabs */}
                <div className="flex gap-1 mb-8 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl w-fit">
                    {([['performance', 'Performance & SEO', 'M13 10V3L4 14h7v7l9-11h-7z'], ['traffic', 'Traffic Analytics', 'M3 3v18h18M7 16l4-4 4 4 4-7']] as const).map(([id, label, d]) => (
                        <button key={id} onClick={() => setTab(id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${tab === id ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-gray-500 hover:text-gray-300 border border-transparent'}`}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={d} /></svg>
                            {label}
                        </button>
                    ))}
                </div>

                {/* ─── Performance tab ─── */}
                {tab === 'performance' && (
                    <div className="animate-reveal">
                        {overview.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/[0.06] rounded-2xl text-center gap-4">
                                <p className="text-gray-400 font-semibold">No projects found</p>
                                <p className="text-gray-600 text-sm">Deploy a project first, then run a performance audit here.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                                <div className="xl:col-span-1 space-y-2">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Projects</p>
                                    {overview.map(({ project, latestAudit }) => (
                                        <button key={project.id} onClick={() => setSelectedPerfId(project.id)}
                                            className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 ${selectedPerfId === project.id ? 'bg-blue-600/10 border-blue-500/30 text-white' : 'bg-white/[0.02] border-white/[0.06] text-gray-400 hover:bg-white/[0.04] hover:text-white'}`}>
                                            <p className="text-sm font-semibold truncate">{project.name}</p>
                                            {latestAudit ? <div className="flex items-center gap-2 mt-1"><ScorePill score={latestAudit.seoScore} /><span className="text-[10px] text-gray-600">SEO</span></div>
                                                : <p className="text-[10px] text-gray-600 mt-1">No audits yet</p>}
                                        </button>
                                    ))}
                                </div>
                                <div className="xl:col-span-3">
                                    {selectedOverview && (
                                        <>
                                            <div className="mb-5">
                                                <h2 className="text-xl font-bold text-white">{selectedOverview.project.name}</h2>
                                                {selectedOverview.project.domains[0] && <p className="text-xs text-gray-500 mt-0.5">{selectedOverview.project.domains[0].hostname}</p>}
                                            </div>
                                            <ProjectAnalytics projectId={selectedOverview.project.id} projectName={selectedOverview.project.name}
                                                deployUrl={selectedOverview.project.domains[0] ? `https://${selectedOverview.project.domains[0].hostname}` : ''} />
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ─── Traffic Analytics tab ─── */}
                {tab === 'traffic' && (
                    <div className="animate-reveal">
                        {umamiServers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/[0.06] rounded-2xl text-center gap-4">
                                <svg className="w-12 h-12 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3v18h18M7 16l4-4 4 4 4-7" /></svg>
                                <p className="text-gray-400 font-semibold">Traffic Analytics not installed</p>
                                <p className="text-gray-600 text-sm mb-2">Install Traffic Analytics from the Marketplace to get started.</p>
                                <Link href="/marketplace" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 text-sm font-semibold hover:bg-blue-600/30 transition-all">Go to Marketplace →</Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                                {/* Left: project list */}
                                <div className="xl:col-span-1">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Projects</p>
                                    <div className="space-y-2 mb-6">
                                        {analyticsProjects.map(p => (
                                            <div key={p.id}
                                                className={`px-4 py-3 rounded-xl border cursor-pointer transition-all duration-200 ${selectedTrafficId === p.id ? 'bg-violet-600/10 border-violet-500/30' : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'}`}
                                                onClick={() => { setSelectedTrafficId(p.id); }}>
                                                <div className="flex items-center justify-between">
                                                    <p className={`text-sm font-semibold truncate ${selectedTrafficId === p.id ? 'text-white' : 'text-gray-400'}`}>{p.name}</p>
                                                    {p.trafficAnalyticsSiteId
                                                        ? <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full ml-1 shrink-0">On</span>
                                                        : <span className="text-[9px] font-bold uppercase tracking-widest text-gray-600 bg-white/[0.03] border border-white/[0.06] px-1.5 py-0.5 rounded-full ml-1 shrink-0">Off</span>}
                                                </div>
                                                <p className="text-[10px] text-gray-600 mt-0.5 truncate">{p.server?.name}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {analyticsProjects.length === 0 && (
                                        <p className="text-sm text-gray-600">No projects on servers with Traffic Analytics installed.</p>
                                    )}
                                </div>

                                {/* Right: analytics detail */}
                                <div className="xl:col-span-3">
                                    {!selectedProject ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                                            <p className="text-gray-500">Select a project to view its analytics</p>
                                        </div>
                                    ) : !selectedProject.trafficAnalyticsSiteId ? (
                                        /* Enable analytics CTA */
                                        <div className="bg-gradient-to-br from-violet-600/10 via-purple-600/5 to-fuchsia-600/5 rounded-2xl border border-white/[0.06] p-10 flex flex-col items-center text-center gap-4">
                                            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-violet-400">
                                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3v18h18M7 16l4-4 4 4 4-7" /></svg>
                                            </div>
                                            <h3 className="text-xl font-bold text-white">Enable Analytics for {selectedProject.name}</h3>
                                            <p className="text-gray-400 text-sm max-w-sm">Hylius will register this project in Umami and automatically inject the tracking script on your next deploy. No code changes needed.</p>
                                            <button onClick={() => enableAnalytics(selectedProject.id)} disabled={enabling}
                                                className="px-6 py-2.5 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-400 text-sm font-semibold hover:bg-violet-600/30 transition-all disabled:opacity-50 flex items-center gap-2">
                                                {enabling ? <><div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />Enabling...</> : '✦ Enable Traffic Analytics'}
                                            </button>
                                            <p className="text-[11px] text-gray-600">After enabling, redeploy your project to start collecting data.</p>
                                        </div>
                                    ) : (
                                        /* Analytics dashboard */
                                        <div>
                                            <div className="flex items-center justify-between mb-5">
                                                <div>
                                                    <h2 className="text-xl font-bold text-white">{selectedProject.name}</h2>
                                                    <p className="text-xs text-gray-500 mt-0.5">{selectedProject.domains[0]?.hostname || 'No domain'}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {/* Period selector */}
                                                    <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                                                        {(['24h', '7d', '30d'] as Period[]).map(p => (
                                                            <button key={p} onClick={() => setPeriod(p)}
                                                                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${period === p ? 'bg-violet-600/20 text-violet-400 border border-violet-500/30' : 'text-gray-500 hover:text-gray-300'}`}>{p}</button>
                                                        ))}
                                                    </div>
                                                    <button onClick={() => disableAnalytics(selectedProject.id)}
                                                        className="px-3 py-1.5 rounded-lg bg-red-500/5 border border-red-500/10 text-red-400/60 text-xs font-semibold hover:bg-red-500/15 hover:text-red-400 transition-all">
                                                        Disable
                                                    </button>
                                                </div>
                                            </div>

                                            {statsLoading ? (
                                                <div className="flex items-center justify-center py-20">
                                                    <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                                                </div>
                                            ) : statsError ? (
                                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                                    <p className="text-red-400 text-sm">{statsError}</p>
                                                    <button onClick={() => fetchStats(selectedProject.id, period)} className="text-xs text-gray-500 hover:text-gray-300 underline">Retry</button>
                                                </div>
                                            ) : !stats ? null : (
                                                <div className="space-y-5">
                                                    {/* Summary cards */}
                                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                                        <StatCard label="Active Now" value={stats.summary.active} />
                                                        <StatCard label="Pageviews" value={fmt(stats.summary.pageviews)} />
                                                        <StatCard label="Visitors" value={fmt(stats.summary.visitors)} />
                                                        <StatCard label="Bounce Rate" value={`${stats.summary.bounceRate}%`} />
                                                        <StatCard label="Avg Duration" value={fmtDur(stats.summary.avgDuration)} />
                                                    </div>

                                                    {/* Pageviews sparkline */}
                                                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <p className="text-sm font-semibold text-gray-400">Pageviews & Sessions</p>
                                                            <SparkLine data={stats.pageviews.pageviews} />
                                                        </div>
                                                        <div className="flex items-end gap-px h-24">
                                                            {stats.pageviews.pageviews.map((d, i) => {
                                                                const max = Math.max(...stats.pageviews.pageviews.map(x => x.y), 1);
                                                                const h = Math.max((d.y / max) * 100, 2);
                                                                return (
                                                                    <div key={i} className="flex-1 flex flex-col justify-end group relative">
                                                                        <div className="bg-violet-500/30 hover:bg-violet-500/60 rounded-sm transition-all" style={{ height: `${h}%` }} title={`${d.y} views`} />
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Metrics grid */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                        {/* Top Pages */}
                                                        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                                                            <p className="text-sm font-semibold text-gray-400 mb-4">Top Pages</p>
                                                            <div className="space-y-3">
                                                                {stats.topPages.length === 0 ? <p className="text-xs text-gray-600">No data yet</p>
                                                                    : stats.topPages.map((d, i) => <MetricBar key={i} label={d.x} value={d.y} max={stats.topPages[0]?.y || 1} />)}
                                                            </div>
                                                        </div>

                                                        {/* Referrers */}
                                                        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                                                            <p className="text-sm font-semibold text-gray-400 mb-4">Referrers</p>
                                                            <div className="space-y-3">
                                                                {stats.referrers.length === 0 ? <p className="text-xs text-gray-600">No referrer data yet</p>
                                                                    : stats.referrers.map((d, i) => <MetricBar key={i} label={d.x} value={d.y} max={stats.referrers[0]?.y || 1} />)}
                                                            </div>
                                                        </div>

                                                        {/* Browsers */}
                                                        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                                                            <p className="text-sm font-semibold text-gray-400 mb-4">Browsers</p>
                                                            <div className="space-y-3">
                                                                {stats.browsers.map((d, i) => <MetricBar key={i} label={d.x} value={d.y} max={stats.browsers[0]?.y || 1} />)}
                                                            </div>
                                                        </div>

                                                        {/* Devices + Countries */}
                                                        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                                                            <p className="text-sm font-semibold text-gray-400 mb-4">Devices</p>
                                                            <div className="space-y-3">
                                                                {stats.devices.map((d, i) => <MetricBar key={i} label={d.x} value={d.y} max={stats.devices[0]?.y || 1} />)}
                                                            </div>
                                                            {stats.countries.length > 0 && (
                                                                <>
                                                                    <p className="text-sm font-semibold text-gray-400 mt-5 mb-4">Countries</p>
                                                                    <div className="space-y-2">
                                                                        {stats.countries.slice(0, 5).map((d, i) => (
                                                                            <div key={i} className="flex items-center justify-between">
                                                                                <span className="text-sm text-gray-400">{d.x}</span>
                                                                                <span className="text-sm text-gray-500">{d.y}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
