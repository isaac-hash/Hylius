"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/providers/auth.provider";

interface AdminServer {
    id: string;
    name: string;
    ip: string;
    port: number;
    username: string;
    osType: string | null;
    createdAt: string;
    organization: { id: string; name: string; slug: string };
    _count: { projects: number; metrics: number };
    metrics: { createdAt: string; cpu: number; memory: number; disk: number }[];
}

type UpdateStatus = 'idle' | 'updating' | 'success' | 'error';

export default function AdminServersPage() {
    const { token } = useAuth();
    const [servers, setServers] = useState<AdminServer[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [updateStatus, setUpdateStatus] = useState<Record<string, UpdateStatus>>({});
    const [updateMsg, setUpdateMsg] = useState<Record<string, string>>({});
    const [updatingAll, setUpdatingAll] = useState(false);

    const fetchServers = useCallback(() => {
        if (!token) return;
        setLoading(true);
        fetch(`/api/admin/servers?page=${page}&limit=20`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                setServers(data.servers || []);
                if (data.pagination) {
                    setTotalPages(data.pagination.totalPages);
                    setTotal(data.pagination.total);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [token, page]);

    useEffect(() => { fetchServers(); }, [fetchServers]);

    const updateAgent = async (serverId: string, serverName: string) => {
        if (!token) return;
        setUpdateStatus(s => ({ ...s, [serverId]: 'updating' }));
        setUpdateMsg(s => ({ ...s, [serverId]: '' }));

        try {
            const res = await fetch(`/api/admin/servers/${serverId}/update-agent`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ dashboardUrl: window.location.origin }),
            });
            const data = await res.json();
            if (res.ok) {
                setUpdateStatus(s => ({ ...s, [serverId]: 'success' }));
                setUpdateMsg(s => ({ ...s, [serverId]: data.message }));
            } else {
                setUpdateStatus(s => ({ ...s, [serverId]: 'error' }));
                setUpdateMsg(s => ({ ...s, [serverId]: data.error || 'Update failed' }));
            }
        } catch {
            setUpdateStatus(s => ({ ...s, [serverId]: 'error' }));
            setUpdateMsg(s => ({ ...s, [serverId]: 'Network error' }));
        }

        // Reset after 8s
        setTimeout(() => setUpdateStatus(s => ({ ...s, [serverId]: 'idle' })), 8000);
    };

    const updateAllAgents = async () => {
        if (!token || !confirm(`Send agent update to all ${servers.length} servers?`)) return;
        setUpdatingAll(true);
        for (const server of servers) {
            await updateAgent(server.id, server.name);
            await new Promise(r => setTimeout(r, 500)); // stagger requests
        }
        setUpdatingAll(false);
    };

    const statusIcon = (id: string) => {
        const s = updateStatus[id];
        if (s === 'updating') return <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />;
        if (s === 'success') return <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>;
        if (s === 'error') return <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>;
        return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>;
    };

    return (
        <div>
            <div className="flex items-end justify-between mb-8">
                <div>
                    <div className="text-blue-500 text-[10px] font-bold uppercase tracking-wider mb-2">Platform Management</div>
                    <h1 className="text-3xl font-bold mb-1">All Servers</h1>
                    <p className="text-gray-400 text-sm">{total} servers across all organizations.</p>
                </div>
                {servers.length > 0 && (
                    <button
                        onClick={updateAllAgents}
                        disabled={updatingAll}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 text-sm font-semibold hover:bg-blue-600/20 transition-all disabled:opacity-50"
                    >
                        {updatingAll
                            ? <><div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />Updating all...</>
                            : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>Update All Agents</>
                        }
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
            ) : servers.length === 0 ? (
                <div className="text-center py-20 bg-gray-900/50 rounded-lg border border-gray-800">
                    <p className="text-gray-400">No servers registered yet.</p>
                </div>
            ) : (
                <>
                    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-800 text-left text-gray-400 text-xs uppercase tracking-wider">
                                    <th className="px-5 py-3">Server</th>
                                    <th className="px-5 py-3">Organization</th>
                                    <th className="px-5 py-3">Projects</th>
                                    <th className="px-5 py-3">Last Metrics</th>
                                    <th className="px-5 py-3">Added</th>
                                    <th className="px-5 py-3">Agent</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {servers.map(server => (
                                    <tr key={server.id} className="hover:bg-gray-800/50 transition-colors">
                                        <td className="px-5 py-4">
                                            <div className="font-medium text-white">{server.name}</div>
                                            <div className="text-gray-500 text-xs font-mono mt-0.5">{server.username}@{server.ip}:{server.port}</div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="text-gray-300">{server.organization.name}</span>
                                            <span className="text-gray-600 text-xs ml-1">({server.organization.slug})</span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-xs font-medium">
                                                {server._count.projects}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            {server.metrics.length > 0 ? (
                                                <div className="text-xs">
                                                    <div className="flex items-center gap-3 text-gray-400">
                                                        <span>CPU {server.metrics[0].cpu.toFixed(0)}%</span>
                                                        <span>MEM {server.metrics[0].memory.toFixed(0)}%</span>
                                                        <span>DSK {server.metrics[0].disk.toFixed(0)}%</span>
                                                    </div>
                                                    <div className="text-gray-600 mt-0.5">
                                                        {new Date(server.metrics[0].createdAt).toLocaleString()}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-gray-600 text-xs">No data</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 text-gray-500 text-xs">
                                            {new Date(server.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex flex-col gap-1">
                                                <button
                                                    onClick={() => updateAgent(server.id, server.name)}
                                                    disabled={updateStatus[server.id] === 'updating'}
                                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap
                                                        ${updateStatus[server.id] === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                                                        : updateStatus[server.id] === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                                                        : 'bg-white/[0.03] border border-white/[0.08] text-gray-400 hover:text-white hover:border-blue-500/30 hover:bg-blue-500/5'} 
                                                        disabled:opacity-50 disabled:cursor-not-allowed`}
                                                >
                                                    {statusIcon(server.id)}
                                                    {updateStatus[server.id] === 'updating' ? 'Updating...'
                                                        : updateStatus[server.id] === 'success' ? 'Updated!'
                                                        : updateStatus[server.id] === 'error' ? 'Failed'
                                                        : 'Update Agent'}
                                                </button>
                                                {updateMsg[server.id] && (
                                                    <p className={`text-[10px] max-w-[180px] leading-tight ${updateStatus[server.id] === 'error' ? 'text-red-400' : 'text-gray-500'}`}>
                                                        {updateMsg[server.id]}
                                                    </p>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-6">
                            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
                            <div className="flex gap-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                                    className="px-3 py-1.5 rounded-md bg-gray-900 border border-gray-800 text-sm text-gray-400 hover:bg-gray-800 disabled:opacity-30 transition-colors">
                                    Previous
                                </button>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                                    className="px-3 py-1.5 rounded-md bg-gray-900 border border-gray-800 text-sm text-gray-400 hover:bg-gray-800 disabled:opacity-30 transition-colors">
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
