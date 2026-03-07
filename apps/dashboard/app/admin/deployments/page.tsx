"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/providers/auth.provider";

interface AdminDeployment {
    id: string;
    releaseId: string;
    commitHash: string | null;
    status: string;
    triggerSource: string;
    durationMs: number | null;
    startedAt: string;
    finishedAt: string | null;
    project: {
        name: string;
        server: { name: string; ip: string };
        organization: { name: string; slug: string };
    };
}

const statusConfig: Record<string, { color: string; bg: string }> = {
    SUCCESS: { color: 'text-green-400', bg: 'bg-green-500/10' },
    FAILED: { color: 'text-red-400', bg: 'bg-red-500/10' },
    PENDING: { color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    BUILDING: { color: 'text-blue-400', bg: 'bg-blue-500/10' },
};

function formatDuration(ms: number | null): string {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

export default function AdminDeploymentsPage() {
    const { token } = useAuth();
    const [deployments, setDeployments] = useState<AdminDeployment[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [statusFilter, setStatusFilter] = useState('');

    const fetchDeployments = useCallback(() => {
        if (!token) return;
        setLoading(true);
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', '20');
        if (statusFilter) params.set('status', statusFilter);

        fetch(`/api/admin/deployments?${params.toString()}`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                setDeployments(data.deployments || []);
                if (data.pagination) {
                    setTotalPages(data.pagination.totalPages);
                    setTotal(data.pagination.total);
                }
                setLoading(false);
            })
            .catch(() => { setLoading(false); });
    }, [token, page, statusFilter]);

    useEffect(() => {
        fetchDeployments();
    }, [fetchDeployments]);

    return (
        <div>
            <div className="flex items-end justify-between mb-8">
                <div>
                    <div className="text-blue-500 text-[10px] font-bold uppercase tracking-wider mb-2">Platform Management</div>
                    <h1 className="text-3xl font-bold mb-1">All Deployments</h1>
                    <p className="text-gray-400 text-sm">{total} deployments across all organizations.</p>
                </div>
                <div className="flex gap-3">
                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                        className="bg-gray-900 border border-gray-800 rounded-md px-3 py-2 text-sm text-white focus:border-blue-600 focus:outline-none transition-colors"
                    >
                        <option value="">All Statuses</option>
                        <option value="SUCCESS">Success</option>
                        <option value="FAILED">Failed</option>
                        <option value="BUILDING">Building</option>
                        <option value="PENDING">Pending</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
            ) : deployments.length === 0 ? (
                <div className="text-center py-20 bg-gray-900/50 rounded-lg border border-gray-800">
                    <p className="text-gray-400">No deployments found.</p>
                </div>
            ) : (
                <>
                    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-800 text-left text-gray-400 text-xs uppercase tracking-wider">
                                    <th className="px-5 py-3">Status</th>
                                    <th className="px-5 py-3">Project</th>
                                    <th className="px-5 py-3">Server</th>
                                    <th className="px-5 py-3">Organization</th>
                                    <th className="px-5 py-3">Release</th>
                                    <th className="px-5 py-3">Source</th>
                                    <th className="px-5 py-3">Duration</th>
                                    <th className="px-5 py-3">Started</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {deployments.map(d => {
                                    const cfg = statusConfig[d.status] || statusConfig.PENDING;
                                    return (
                                        <tr key={d.id} className="hover:bg-gray-800/50 transition-colors">
                                            <td className="px-5 py-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.color} ${cfg.bg}`}>
                                                    {d.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-white font-medium">{d.project?.name || '—'}</td>
                                            <td className="px-5 py-4">
                                                <div className="text-gray-300">{d.project?.server?.name || '—'}</div>
                                                <div className="text-gray-600 text-xs font-mono">{d.project?.server?.ip || ''}</div>
                                            </td>
                                            <td className="px-5 py-4 text-gray-400">{d.project?.organization?.name || '—'}</td>
                                            <td className="px-5 py-4 text-gray-400 font-mono text-xs">{d.releaseId !== 'pending' ? d.releaseId : '—'}</td>
                                            <td className="px-5 py-4 text-gray-500 uppercase text-xs">{d.triggerSource}</td>
                                            <td className="px-5 py-4 text-gray-400 text-xs">{formatDuration(d.durationMs)}</td>
                                            <td className="px-5 py-4 text-gray-500 text-xs">{new Date(d.startedAt).toLocaleString()}</td>
                                        </tr>
                                    );
                                })}
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
