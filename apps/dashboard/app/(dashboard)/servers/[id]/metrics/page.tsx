'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';
import { useAuth } from '@/providers/auth.provider';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MetricPoint {
    cpu: number;
    memory: number;
    disk: number;
    uptime: number;
    createdAt: string;
}

interface StatSummary {
    current: number;
    avg: number;
    peak: number;
}

interface MetricsResponse {
    range: string;
    points: MetricPoint[];
    stats: {
        cpu: StatSummary;
        memory: StatSummary;
        disk: StatSummary;
    };
}

type Range = '1h' | '6h' | '24h' | '7d' | '30d';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) { return v.toFixed(1) + '%'; }

function formatUptime(seconds: number) {
    if (!seconds) return '—';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function formatTime(iso: string, range: Range) {
    const d = new Date(iso);
    if (range === '1h' || range === '6h') {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (range === '24h') {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function trendArrow(current: number, avg: number) {
    const diff = current - avg;
    if (Math.abs(diff) < 1) return { icon: '→', color: 'text-gray-400' };
    if (diff > 0) return { icon: '↑', color: 'text-red-400' };
    return { icon: '↓', color: 'text-green-400' };
}

// Detect anomaly spikes: value > mean + 2*stddev
function detectAnomalies(points: MetricPoint[], field: 'cpu' | 'memory' | 'disk'): number[] {
    if (points.length < 5) return [];
    const vals = points.map(p => p[field]);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
    return vals.reduce<number[]>((acc, v, i) => {
        if (v > mean + 2 * std && v > 80) acc.push(i);
        return acc;
    }, []);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
    label, current, avg, peak, color, icon,
}: {
    label: string;
    current: number;
    avg: number;
    peak: number;
    color: string;
    icon: React.ReactNode;
}) {
    const trend = trendArrow(current, avg);
    return (
        <div className={`bg-gray-900 border ${color} rounded-xl p-5 flex flex-col gap-3`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold uppercase tracking-wider">
                    {icon}
                    {label}
                </div>
                <span className={`text-xs font-bold ${trend.color}`}>{trend.icon} vs avg</span>
            </div>
            <div className="text-3xl font-bold text-white">{fmt(current)}</div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                <div>
                    <span className="block text-gray-600 uppercase tracking-wider mb-0.5">Avg</span>
                    <span className="text-gray-300 font-mono">{fmt(avg)}</span>
                </div>
                <div>
                    <span className="block text-gray-600 uppercase tracking-wider mb-0.5">Peak</span>
                    <span className="text-gray-300 font-mono">{fmt(peak)}</span>
                </div>
            </div>
        </div>
    );
}

function MetricChart({
    title,
    data,
    field,
    color,
    gradientId,
    range,
    warningThreshold,
    dangerThreshold,
    anomalyIndices,
}: {
    title: string;
    data: MetricPoint[];
    field: 'cpu' | 'memory' | 'disk';
    color: string;
    gradientId: string;
    range: Range;
    warningThreshold?: number;
    dangerThreshold?: number;
    anomalyIndices: number[];
}) {
    const chartData = data.map((p, i) => ({
        time: formatTime(p.createdAt, range),
        value: parseFloat(p[field].toFixed(2)),
        _isAnomaly: anomalyIndices.includes(i),
    }));

    const CustomDot = (props: any) => {
        const { cx, cy, payload } = props;
        if (!payload._isAnomaly) return null;
        return <circle cx={cx} cy={cy} r={4} fill="#ef4444" stroke="#1f2937" strokeWidth={1} />;
    };

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
                {anomalyIndices.length > 0 && (
                    <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                        {anomalyIndices.length} spike{anomalyIndices.length > 1 ? 's' : ''} detected
                    </span>
                )}
            </div>

            {data.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-gray-600 text-sm">
                    No data yet — metrics will appear after the next agent heartbeat (30s)
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis
                            dataKey="time"
                            tick={{ fill: '#4b5563', fontSize: 10 }}
                            interval="preserveStartEnd"
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            domain={[0, 100]}
                            tick={{ fill: '#4b5563', fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                            contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                            labelStyle={{ color: '#9ca3af' }}
                            itemStyle={{ color: color }}
                            formatter={(v: number) => [`${v.toFixed(1)}%`, field.toUpperCase()]}
                        />
                        {warningThreshold && (
                            <ReferenceLine y={warningThreshold} stroke="#f59e0b" strokeDasharray="4 4"
                                label={{ value: `${warningThreshold}% warn`, position: 'insideTopRight', fill: '#f59e0b', fontSize: 10 }} />
                        )}
                        {dangerThreshold && (
                            <ReferenceLine y={dangerThreshold} stroke="#ef4444" strokeDasharray="4 4"
                                label={{ value: `${dangerThreshold}% danger`, position: 'insideTopRight', fill: '#ef4444', fontSize: 10 }} />
                        )}
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={color}
                            strokeWidth={1.5}
                            fill={`url(#${gradientId})`}
                            dot={<CustomDot />}
                            activeDot={{ r: 4, fill: color, stroke: '#111827', strokeWidth: 2 }}
                            isAnimationActive={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ServerMetricsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { token } = useAuth();

    const [data, setData] = useState<MetricsResponse | null>(null);
    const [range, setRange] = useState<Range>('24h');
    const [loading, setLoading] = useState(true);
    const [serverName, setServerName] = useState('');
    const [lastUptime, setLastUptime] = useState(0);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const fetch_ = useCallback(() => {
        if (!token) return;
        fetch(`/api/servers/${id}/metrics?range=${range}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => r.json())
            .then((d: MetricsResponse) => {
                setData(d);
                if (d.points.length > 0) {
                    setLastUptime(d.points[d.points.length - 1].uptime);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [id, token, range]);

    // Also fetch server name for the breadcrumb
    useEffect(() => {
        if (!token) return;
        fetch(`/api/servers/${id}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then((s: any) => setServerName(s.name ?? ''))
            .catch(() => {});
    }, [id, token]);

    useEffect(() => {
        setLoading(true);
        fetch_();
    }, [fetch_]);

    // Auto-refresh every 30s when on 1h/6h/24h range
    useEffect(() => {
        if (!autoRefresh || range === '7d' || range === '30d') return;
        const t = setInterval(fetch_, 30_000);
        return () => clearInterval(t);
    }, [fetch_, autoRefresh, range]);

    const points = data?.points ?? [];
    const stats = data?.stats;

    const cpuAnomalies = detectAnomalies(points, 'cpu');
    const memAnomalies = detectAnomalies(points, 'memory');
    const diskAnomalies = detectAnomalies(points, 'disk');

    const ranges: Range[] = ['1h', '6h', '24h', '7d', '30d'];

    return (
        <div className="max-w-7xl mx-auto py-6 space-y-6">
            {/* Breadcrumb */}
            <header className="flex items-center gap-2 text-sm text-gray-400">
                <Link href="/" className="hover:text-white transition-colors">Servers</Link>
                <span>/</span>
                <Link href={`/servers/${id}`} className="hover:text-white transition-colors">
                    {serverName || 'Server'}
                </Link>
                <span>/</span>
                <span className="text-gray-200">Metrics</span>
            </header>

            {/* Page header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Server Metrics</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Historical resource usage — snapshots recorded every 30 seconds.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Auto-refresh toggle */}
                    <button
                        onClick={() => setAutoRefresh(a => !a)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${autoRefresh
                            ? 'border-green-500/40 text-green-400 bg-green-500/10'
                            : 'border-gray-700 text-gray-500 bg-gray-800/50'
                        }`}
                    >
                        {autoRefresh ? '● Live' : '○ Paused'}
                    </button>

                    {/* Manual refresh */}
                    <button
                        onClick={() => { setLoading(true); fetch_(); }}
                        className="p-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                        title="Refresh"
                    >
                        <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>

                    {/* Time range */}
                    <div className="flex items-center rounded-lg border border-gray-700 overflow-hidden">
                        {ranges.map(r => (
                            <button
                                key={r}
                                onClick={() => setRange(r)}
                                className={`px-3 py-1.5 text-xs font-medium transition-colors ${range === r
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                }`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Summary stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats ? (
                    <>
                        <StatCard
                            label="CPU Usage"
                            current={stats.cpu.current}
                            avg={stats.cpu.avg}
                            peak={stats.cpu.peak}
                            color="border-blue-500/20"
                            icon={
                                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                                </svg>
                            }
                        />
                        <StatCard
                            label="Memory"
                            current={stats.memory.current}
                            avg={stats.memory.avg}
                            peak={stats.memory.peak}
                            color="border-purple-500/20"
                            icon={
                                <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            }
                        />
                        <StatCard
                            label="Disk"
                            current={stats.disk.current}
                            avg={stats.disk.avg}
                            peak={stats.disk.peak}
                            color="border-amber-500/20"
                            icon={
                                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                                </svg>
                            }
                        />
                        {/* Uptime card */}
                        <div className="bg-gray-900 border border-green-500/20 rounded-xl p-5 flex flex-col gap-3">
                            <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold uppercase tracking-wider">
                                <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Server Uptime
                            </div>
                            <div className="text-3xl font-bold text-white">{formatUptime(lastUptime)}</div>
                            <div className="text-xs text-gray-600">
                                {lastUptime > 0
                                    ? `${Math.floor(lastUptime / 86400)} days continuous`
                                    : 'No data yet'}
                            </div>
                        </div>
                    </>
                ) : (
                    /* Skeleton */
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 h-36 animate-pulse" />
                    ))
                )}
            </div>

            {/* Anomaly banner */}
            {(cpuAnomalies.length > 0 || memAnomalies.length > 0 || diskAnomalies.length > 0) && (
                <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-300">
                    <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                        <span className="font-semibold text-red-300">Anomalies detected in this time window — </span>
                        {[
                            cpuAnomalies.length > 0 && `${cpuAnomalies.length} CPU spike${cpuAnomalies.length > 1 ? 's' : ''}`,
                            memAnomalies.length > 0 && `${memAnomalies.length} memory spike${memAnomalies.length > 1 ? 's' : ''}`,
                            diskAnomalies.length > 0 && `${diskAnomalies.length} disk spike${diskAnomalies.length > 1 ? 's' : ''}`,
                        ].filter(Boolean).join(', ')}.
                        <span className="text-red-400/70"> Red dots mark the moments of impact.</span>
                    </div>
                </div>
            )}

            {/* Charts */}
            <div className="space-y-4">
                <MetricChart
                    title="CPU Usage"
                    data={points}
                    field="cpu"
                    color="#3b82f6"
                    gradientId="cpuGrad"
                    range={range}
                    warningThreshold={75}
                    dangerThreshold={90}
                    anomalyIndices={cpuAnomalies}
                />
                <MetricChart
                    title="Memory Usage"
                    data={points}
                    field="memory"
                    color="#a855f7"
                    gradientId="memGrad"
                    range={range}
                    warningThreshold={80}
                    dangerThreshold={95}
                    anomalyIndices={memAnomalies}
                />
                <MetricChart
                    title="Disk Usage"
                    data={points}
                    field="disk"
                    color="#f59e0b"
                    gradientId="diskGrad"
                    range={range}
                    warningThreshold={70}
                    dangerThreshold={85}
                    anomalyIndices={diskAnomalies}
                />
            </div>

            {/* Data notice */}
            <p className="text-xs text-gray-600 text-center pb-4">
                Showing {points.length} data point{points.length !== 1 ? 's' : ''} in the {range} window.
                Snapshots recorded every 30 seconds. Data older than 24h is pruned automatically.
            </p>
        </div>
    );
}
