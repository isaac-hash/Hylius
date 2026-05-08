"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/providers/auth.provider";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

interface UptimeIncident {
    id: string;
    status: "ONGOING" | "RESOLVED";
    startedAt: string;
    resolvedAt: string | null;
    duration: number | null;
    autoHealed: boolean;
    error: string | null;
}

interface UptimeMonitor {
    id: string;
    name: string;
    endpoint: string;
    type: string;
    interval: number;
    autoHeal: boolean;
    status: "ONLINE" | "OFFLINE" | "PENDING" | "PAUSED";
    server: { name: string };
    project: { id: string; name: string } | null;
    incidents: UptimeIncident[];
}

export default function UptimePage() {
    const { token, organization, user } = useAuth();
    const isFreePlan = (!organization?.plan || organization.plan === "FREE") && user?.role !== "PLATFORM_ADMIN";
    const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchMonitors = async () => {
        if (!token) return;
        try {
            const res = await fetch("/api/uptime", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setMonitors(data);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMonitors();
        const interval = setInterval(fetchMonitors, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [token]);

    if (isFreePlan) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-4">
                    <h2 className="text-2xl font-bold text-white">Uptime Monitoring</h2>
                    <p className="text-gray-400 max-w-md mx-auto">This feature requires a paid plan. Upgrade to automatically monitor your deployments and auto-heal crashed containers.</p>
                    <Link href="/billing" className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
                        Upgrade to Pro
                    </Link>
                </div>
            </div>
        );
    }

    // Flatten incidents from all monitors, sort by startedAt desc
    const allIncidents = monitors
        .flatMap((m) => m.incidents.map((i) => ({ ...i, monitorName: m.name })))
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        .slice(0, 10);

    return (
        <div className="py-6">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Uptime Monitors</h1>
                <p className="text-gray-400">Real-time status of your deployed services. Auto-healing is enabled for monitors managed by Hylius.</p>
            </header>

            {loading ? (
                <div className="animate-pulse space-y-4">
                    <div className="h-32 bg-white/5 rounded-xl"></div>
                    <div className="h-32 bg-white/5 rounded-xl"></div>
                </div>
            ) : monitors.length === 0 ? (
                <div className="border border-dashed border-white/10 rounded-xl p-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 text-gray-400">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">No monitors configured</h3>
                    <p className="text-gray-400 max-w-sm mx-auto mb-6">Install "Uptime Monitor" on your servers via the Marketplace, and deploy your projects to automatically monitor them.</p>
                    <Link href="/marketplace" className="inline-block px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/10 text-white rounded-lg transition-colors font-medium">
                        Go to Marketplace
                    </Link>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Status Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {monitors.map((m) => (
                            <div key={m.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-5 hover:bg-white/[0.04] transition-colors relative overflow-hidden group">
                                {m.status === "OFFLINE" && (
                                    <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 animate-pulse"></div>
                                )}
                                {m.status === "ONLINE" && (
                                    <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500/50"></div>
                                )}
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-white flex items-center gap-2">
                                            {m.name}
                                            {m.autoHeal && (
                                                <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20" title="Auto-heal enabled">
                                                    AUTO
                                                </span>
                                            )}
                                        </h3>
                                        <a href={m.endpoint} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline break-all">
                                            {m.endpoint}
                                        </a>
                                    </div>
                                    <div className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full border ${
                                        m.status === "ONLINE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                        m.status === "OFFLINE" ? "bg-red-500/10 text-red-400 border-red-500/20 animate-pulse" :
                                        "bg-gray-500/10 text-gray-400 border-gray-500/20"
                                    }`}>
                                        {m.status}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                    <div className="flex items-center gap-1.5">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
                                        Server: {m.server.name}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        {m.interval}s
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Incidents Timeline */}
                    <div>
                        <h2 className="text-xl font-bold text-white mb-4">Recent Incidents</h2>
                        {allIncidents.length === 0 ? (
                            <div className="text-sm text-gray-500 bg-white/[0.02] border border-white/5 rounded-xl p-4">
                                No incidents recorded yet. 100% uptime! 🎉
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {allIncidents.map((i) => (
                                    <div key={i.id} className="flex items-start gap-4 bg-white/[0.02] border border-white/5 rounded-xl p-4">
                                        <div className={`mt-0.5 w-2 h-2 rounded-full ${i.status === "ONGOING" ? "bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" : "bg-emerald-500"}`}></div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="font-semibold text-white">
                                                    {i.monitorName} <span className="text-gray-400 font-normal">went {i.status === "ONGOING" ? "down" : "offline"}</span>
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {formatDistanceToNow(new Date(i.startedAt), { addSuffix: true })}
                                                </div>
                                            </div>
                                            <div className="text-sm text-red-400/80 mb-2 font-mono text-[11px]">
                                                {i.error}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-gray-400">
                                                {i.status === "RESOLVED" && i.duration && (
                                                    <span className="flex items-center gap-1.5 text-emerald-400">
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                        Resolved after {i.duration}s
                                                    </span>
                                                )}
                                                {i.autoHealed && (
                                                    <span className="flex items-center gap-1.5 text-blue-400">
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                        Auto-healed container
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
