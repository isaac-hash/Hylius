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

export default function AdminServersPage() {
    const { token } = useAuth();
    const [servers, setServers] = useState<AdminServer[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

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
            .catch(() => { setLoading(false); });
    }, [token, page]);

    useEffect(() => {
        fetchServers();
    }, [fetchServers]);

    return (
        <div>
            <div className="flex items-end justify-between mb-8">
                <div>
                    <div className="text-blue-500 text-[10px] font-bold uppercase tracking-wider mb-2">Platform Management</div>
                    <h1 className="text-3xl font-bold mb-1">All Servers</h1>
                    <p className="text-gray-400 text-sm">{total} servers across all organizations.</p>
                </div>
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
                                <button
                                    onClick={() => { setPage(p => Math.max(1, p - 1)); }}
                                    disabled={page <= 1}
                                    className="px-3 py-1.5 rounded-md bg-gray-900 border border-gray-800 text-sm text-gray-400 hover:bg-gray-800 disabled:opacity-30 transition-colors"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => { setPage(p => Math.min(totalPages, p + 1)); }}
                                    disabled={page >= totalPages}
                                    className="px-3 py-1.5 rounded-md bg-gray-900 border border-gray-800 text-sm text-gray-400 hover:bg-gray-800 disabled:opacity-30 transition-colors"
                                >
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
