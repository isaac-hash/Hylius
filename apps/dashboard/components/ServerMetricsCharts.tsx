'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';

interface Metric {
    cpu: number;
    memory: number;
    disk: number;
    uptime: number;
    createdAt: string;
}

interface ServerMetricsProps {
    serverId: string;
    token: string;
    initialMetrics: Metric | null;
}

export default function ServerMetrics({ serverId, token, initialMetrics }: ServerMetricsProps) {
    const [metricsHistory, setMetricsHistory] = useState<Metric[]>(
        initialMetrics ? [initialMetrics] : []
    );
    const [liveMetrics, setLiveMetrics] = useState<Metric | null>(initialMetrics);

    const [loadingPulse, setLoadingPulse] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [pulseError, setPulseError] = useState('');
    const [isFreePlan, setIsFreePlan] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('hylius-autopoll') === 'true';
        }
        return false;
    });

    const fetchPulse = useCallback(async () => {
        if (!token || !serverId) return;
        setLoadingPulse(true);
        setPulseError('');
        try {
            const res = await fetch(`/api/servers/${serverId}/pulse`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Pulse check failed');
            }
            const data = await res.json();
            setLiveMetrics(data);
            
            // If we are not on a free plan, append the live point to the history chart
            if (!isFreePlan) {
                setMetricsHistory(prev => {
                    const next = [...prev, data];
                    // keep last 100 on frontend natively
                    if (next.length > 100) return next.slice(next.length - 100);
                    return next;
                });
            }
        } catch (err: any) {
            setPulseError(err.message || 'Pulse check failed');
        } finally {
            setLoadingPulse(false);
        }
    }, [serverId, token, isFreePlan]);

    const fetchHistory = useCallback(async () => {
        if (!token || !serverId) return;
        try {
            const res = await fetch(`/api/servers/${serverId}/metrics`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.status === 403) {
                setIsFreePlan(true);
                setLoadingHistory(false);
                return;
            }
            if (!res.ok) {
                throw new Error('Failed to load metrics history');
            }
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                setMetricsHistory(data);
                // Also update the live metric to the latest one
                setLiveMetrics(data[data.length - 1]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingHistory(false);
        }
    }, [serverId, token]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    // Auto-refresh interval
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('hylius-autopoll', String(autoRefresh));
        }
        
        let interval: NodeJS.Timeout;
        if (autoRefresh) {
            interval = setInterval(() => {
                fetchPulse();
            }, 30000); // 30 seconds
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [autoRefresh, fetchPulse]);

    const formatXAxis = (tickItem: string) => {
        const date = new Date(tickItem);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    };

    const renderCustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const date = new Date(label);
            return (
                <div className="bg-gray-900 border border-gray-700 p-3 rounded-lg shadow-xl text-sm">
                    <p className="text-gray-400 mb-2">{date.toLocaleString()}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-gray-200">{entry.name}:</span>
                            <span className="font-mono text-white">{entry.value.toFixed(1)}%</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    // Calculate Uptime Display
    const formatUptime = (s: number) => {
        const d = Math.floor(s / 86400);
        const h = Math.floor((s % 86400) / 3600);
        const m = Math.floor((s % 3600) / 60);
        return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                    {isFreePlan ? 'Live Metrics' : 'Server Metrics'}
                </h3>
                
                <div className="flex items-center gap-3">
                    {!isFreePlan && (
                        <label className="flex items-center gap-2 cursor-pointer">
                            <div className="relative">
                                <input 
                                    type="checkbox" 
                                    className="sr-only" 
                                    checked={autoRefresh} 
                                    onChange={() => setAutoRefresh(!autoRefresh)} 
                                />
                                <div className={`block w-10 h-6 rounded-full transition-colors ${autoRefresh ? 'bg-blue-600' : 'bg-gray-700'}`}></div>
                                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${autoRefresh ? 'transform translate-x-4' : ''}`}></div>
                            </div>
                            <span className="text-xs text-gray-400 font-medium">Auto-poll (30s)</span>
                        </label>
                    )}

                    <button
                        onClick={fetchPulse}
                        disabled={loadingPulse}
                        className="text-xs px-3 py-1.5 rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                        {loadingPulse ? (
                            <>
                                <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                                Checking...
                            </>
                        ) : (
                            <>
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                Refresh
                            </>
                        )}
                    </button>
                </div>
            </div>

            {pulseError && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2 mb-3">
                    {pulseError}
                </div>
            )}

            {isFreePlan ? (
                // FREE PLAN: Fallback to old static progress bars
                <div className="space-y-4 relative">
                    {/* Upgrade Banner Overlay */}
                    <div className="absolute -inset-2 bg-gradient-to-t from-gray-900/90 via-gray-900/50 to-transparent z-10 flex items-end justify-center pb-4 backdrop-blur-[1px] pointer-events-none">
                        <div className="pointer-events-auto bg-gray-900 border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.15)] p-3 rounded-lg flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-amber-400">Unlock Historical Charts</p>
                                <p className="text-[10px] text-gray-400">Upgrade to Pro to track metrics over time.</p>
                            </div>
                            <a href="/billing" className="ml-2 text-xs bg-amber-500 text-amber-950 font-bold px-3 py-1.5 rounded hover:bg-amber-400 transition-colors">
                                Upgrade
                            </a>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span>CPU Usage</span>
                            <span className="font-mono text-gray-400">{liveMetrics ? `${liveMetrics.cpu.toFixed(1)}%` : '--%'}</span>
                        </div>
                        <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${liveMetrics && liveMetrics.cpu > 80 ? 'bg-red-500' : liveMetrics && liveMetrics.cpu > 50 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                                style={{ width: `${liveMetrics ? Math.min(liveMetrics.cpu, 100) : 0}%` }}
                            ></div>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span>Memory</span>
                            <span className="font-mono text-gray-400">{liveMetrics ? `${liveMetrics.memory.toFixed(1)}%` : '--%'}</span>
                        </div>
                        <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${liveMetrics && liveMetrics.memory > 80 ? 'bg-red-500' : liveMetrics && liveMetrics.memory > 50 ? 'bg-yellow-500' : 'bg-purple-500'}`}
                                style={{ width: `${liveMetrics ? Math.min(liveMetrics.memory, 100) : 0}%` }}
                            ></div>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span>Storage</span>
                            <span className="font-mono text-gray-400">{liveMetrics ? `${liveMetrics.disk.toFixed(1)}%` : '--%'}</span>
                        </div>
                        <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${liveMetrics && liveMetrics.disk > 80 ? 'bg-red-500' : liveMetrics && liveMetrics.disk > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                style={{ width: `${liveMetrics ? Math.min(liveMetrics.disk, 100) : 0}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            ) : (
                // PRO PLAN: Recharts View
                <div className="space-y-6">
                    {loadingHistory ? (
                        <div className="h-64 flex items-center justify-center border-2 border-gray-800 border-dashed rounded-lg">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        </div>
                    ) : metricsHistory.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center border-2 border-gray-800 border-dashed rounded-lg text-gray-500 gap-2">
                            <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                            <p className="text-sm">No historical data available yet</p>
                            <p className="text-xs">Click Refresh to fetch the first data point.</p>
                        </div>
                    ) : (
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={metricsHistory} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                                    <XAxis 
                                        dataKey="createdAt" 
                                        tickFormatter={formatXAxis} 
                                        stroke="#4b5563"
                                        tick={{ fill: '#6b7280', fontSize: 11 }}
                                        tickLine={false}
                                        axisLine={false}
                                        minTickGap={30}
                                    />
                                    <YAxis 
                                        stroke="#4b5563"
                                        tick={{ fill: '#6b7280', fontSize: 11 }}
                                        tickLine={false}
                                        axisLine={false}
                                        domain={[0, 100]}
                                        tickFormatter={(val) => `${val}%`}
                                    />
                                    <Tooltip content={renderCustomTooltip} cursor={{ stroke: '#374151', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} iconType="circle" />
                                    
                                    <Line 
                                        type="monotone" 
                                        dataKey="cpu" 
                                        name="CPU" 
                                        stroke="#3b82f6" 
                                        strokeWidth={2} 
                                        dot={false} 
                                        activeDot={{ r: 4, fill: '#3b82f6', stroke: '#000', strokeWidth: 2 }} 
                                        isAnimationActive={false}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="memory" 
                                        name="Memory" 
                                        stroke="#8b5cf6" 
                                        strokeWidth={2} 
                                        dot={false} 
                                        activeDot={{ r: 4, fill: '#8b5cf6', stroke: '#000', strokeWidth: 2 }} 
                                        isAnimationActive={false}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="disk" 
                                        name="Storage" 
                                        stroke="#10b981" 
                                        strokeWidth={2} 
                                        dot={false} 
                                        activeDot={{ r: 4, fill: '#10b981', stroke: '#000', strokeWidth: 2 }} 
                                        isAnimationActive={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Current Stats summary */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-800 text-center">
                        <div>
                            <span className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">CPU</span>
                            <span className="text-sm font-mono text-blue-400 font-medium">{liveMetrics ? `${liveMetrics.cpu.toFixed(1)}%` : '--%'}</span>
                        </div>
                        <div>
                            <span className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Memory</span>
                            <span className="text-sm font-mono text-purple-400 font-medium">{liveMetrics ? `${liveMetrics.memory.toFixed(1)}%` : '--%'}</span>
                        </div>
                        <div>
                            <span className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Storage</span>
                            <span className="text-sm font-mono text-green-400 font-medium">{liveMetrics ? `${liveMetrics.disk.toFixed(1)}%` : '--%'}</span>
                        </div>
                    </div>
                </div>
            )}

            <div className={`pt-4 mt-4 border-t border-gray-800 ${isFreePlan ? 'opacity-50' : ''}`}>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Uptime</span>
                    <span className="font-mono text-gray-300">
                        {liveMetrics ? formatUptime(liveMetrics.uptime) : '—'}
                    </span>
                </div>
                {liveMetrics?.createdAt && (
                    <p className="text-xs text-gray-600 mt-1">
                        Last synced {new Date(liveMetrics.createdAt).toLocaleString()}
                    </p>
                )}
            </div>
        </div>
    );
}
