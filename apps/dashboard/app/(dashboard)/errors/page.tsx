"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/providers/auth.provider";
import Link from "next/link";

interface Issue {
    id: string;
    title: string;
    metadata: {
        type: string;
        value: string;
    };
    count: string;
    userCount: number;
    lastSeen: string;
    firstSeen: string;
    level: string;
    status: string;
}

export default function ErrorsPage() {
    const { token, organization, user } = useAuth();
    const isFreePlan = (!organization?.plan || organization.plan === "FREE") && user?.role !== "PLATFORM_ADMIN";

    const [projects, setProjects] = useState<any[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>("");
    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) return;
        fetch("/api/projects", {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    // Filter projects that are on a server with hasErrorTracking
                    const validProjects = data.filter(p => p.server?.hasErrorTracking);
                    setProjects(validProjects);
                    if (validProjects.length > 0) {
                        setSelectedProjectId(validProjects[0].id);
                    }
                }
            });
    }, [token]);

    useEffect(() => {
        if (!token || !selectedProjectId) return;
        setLoading(true);
        setError(null);
        fetch(`/api/projects/${selectedProjectId}/errors`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    setError(data.error);
                    setIssues([]);
                } else if (Array.isArray(data)) {
                    setIssues(data);
                } else {
                    setIssues([]);
                }
            })
            .catch(err => {
                setError(err.message || "Failed to load errors");
            })
            .finally(() => {
                setLoading(false);
            });
    }, [token, selectedProjectId]);

    if (isFreePlan) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] text-center animate-reveal">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                        <path d="M12 9v4" />
                        <path d="M12 17h.01" />
                    </svg>
                </div>
                <h1 className="text-2xl font-display font-bold text-white mb-2">Native Error Tracking</h1>
                <p className="text-gray-400 max-w-md mb-8">
                    Automatically catch unhandled exceptions, network failures, and stack traces across your entire stack. Upgrade to Pro to unlock this feature.
                </p>
                <Link href="/billing" className="px-6 py-2.5 bg-white text-black text-sm font-semibold rounded-xl hover:bg-gray-100 transition-colors">
                    Upgrade Plan
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground py-6">
            <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-reveal">
                <div>
                    <h1 className="font-display text-3xl font-bold tracking-tight text-white mb-1">Error Tracking</h1>
                    <p className="text-gray-400 text-sm">Monitor unhandled exceptions across your projects</p>
                </div>
                
                {projects.length > 0 && (
                    <select
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className="bg-gray-900/80 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-red-500/50"
                    >
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                )}
            </header>

            {projects.length === 0 ? (
                <div className="bg-gray-900/30 border border-white/5 rounded-2xl p-10 text-center animate-reveal">
                    <p className="text-gray-400 mb-4">No projects have Error Tracking enabled.</p>
                    <Link href="/marketplace" className="text-red-400 hover:text-red-300 font-medium text-sm">
                        Install from Marketplace &rarr;
                    </Link>
                </div>
            ) : (
                <div className="space-y-4 animate-reveal" style={{ animationDelay: "0.1s" }}>
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : error ? (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
                            {error}
                        </div>
                    ) : issues.length === 0 ? (
                        <div className="bg-gray-900/30 border border-white/5 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                            </div>
                            <h3 className="text-white font-medium text-lg mb-1">Zero Errors Found</h3>
                            <p className="text-gray-500 text-sm">Your application is running smoothly.</p>
                        </div>
                    ) : (
                        <div className="bg-gray-900/50 border border-white/[0.06] rounded-2xl overflow-hidden">
                            <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/[0.06] text-xs font-semibold text-gray-500 uppercase tracking-wider bg-black/20">
                                <div className="col-span-6 sm:col-span-8">Event</div>
                                <div className="col-span-3 sm:col-span-2 text-right">Events</div>
                                <div className="col-span-3 sm:col-span-2 text-right">Users</div>
                            </div>
                            <div className="divide-y divide-white/[0.06]">
                                {issues.map(issue => (
                                    <div key={issue.id} className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors items-center">
                                        <div className="col-span-6 sm:col-span-8">
                                            <div className="flex items-center gap-3">
                                                <span className={`w-2 h-2 rounded-full ${issue.level === 'error' ? 'bg-red-500' : 'bg-amber-500'}`} />
                                                <div>
                                                    <h4 className="text-red-400 font-medium text-sm truncate max-w-lg mb-0.5">
                                                        {issue.metadata?.type || 'Error'}
                                                    </h4>
                                                    <p className="text-gray-400 text-xs truncate max-w-lg">
                                                        {issue.title}
                                                    </p>
                                                    <div className="text-gray-500 text-[10px] mt-1">
                                                        Last seen: {new Date(issue.lastSeen).toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-span-3 sm:col-span-2 text-right text-sm text-gray-300 font-medium">
                                            {issue.count}
                                        </div>
                                        <div className="col-span-3 sm:col-span-2 text-right text-sm text-gray-300 font-medium">
                                            {issue.userCount}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
