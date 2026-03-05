'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/providers/auth.provider';

interface Deployment {
    id: string;
    releaseId: string;
    commitHash: string | null;
    status: string;
    triggerSource: string;
    durationMs: number | null;
    startedAt: string;
    finishedAt: string | null;
    deployUrl: string | null;
    project?: { name: string; server?: { name: string } };
}

interface DeploymentHistoryProps {
    projectId?: string;
    serverId?: string;
    refreshKey?: number; // Increment to trigger a refetch
}

const statusConfig: Record<string, { color: string; bg: string; glow: string }> = {
    SUCCESS: { color: 'text-green-400', bg: 'bg-green-500/10', glow: 'shadow-[0_0_6px_rgba(34,197,94,0.3)]' },
    FAILED: { color: 'text-red-400', bg: 'bg-red-500/10', glow: 'shadow-[0_0_6px_rgba(239,68,68,0.3)]' },
    PENDING: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', glow: 'shadow-[0_0_6px_rgba(234,179,8,0.3)]' },
    BUILDING: { color: 'text-blue-400', bg: 'bg-blue-500/10', glow: 'shadow-[0_0_6px_rgba(59,130,246,0.3)]' },
};

function formatDuration(ms: number | null): string {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export default function DeploymentHistory({ projectId, serverId, refreshKey }: DeploymentHistoryProps) {
    const { token } = useAuth();
    const [deployments, setDeployments] = useState<Deployment[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchDeployments = useCallback(() => {
        setLoading(true);

        // Build URL with query params
        const params = new URLSearchParams();
        if (projectId) params.set('projectId', projectId);
        if (serverId) params.set('serverId', serverId);
        const queryString = params.toString();
        const url = queryString ? `/api/deployments?${queryString}` : '/api/deployments';

        if (!token) return;

        fetch(url, { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) setDeployments(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [projectId, serverId, token]);

    useEffect(() => {
        if (token) fetchDeployments();
    }, [fetchDeployments, refreshKey, token]);

    if (loading && deployments.length === 0) {
        return (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="animate-pulse space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 bg-gray-800 rounded" />
                    ))}
                </div>
            </div>
        );
    }

    if (deployments.length === 0) {
        return (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <p className="text-gray-500 text-center text-sm">No deployments yet</p>
                <p className="text-gray-600 text-center text-xs mt-1">
                    Trigger a deployment to see history here.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-lg divide-y divide-gray-800 overflow-hidden">
            {deployments.map((d) => {
                const cfg = statusConfig[d.status] || statusConfig.PENDING;
                return (
                    <div key={d.id} className="px-4 py-3 hover:bg-gray-800/50 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.color} ${cfg.bg} ${cfg.glow}`}>
                                    {d.status}
                                </span>
                                <span className="text-gray-400 text-xs font-mono">
                                    {d.releaseId !== 'pending' ? d.releaseId : '—'}
                                </span>
                            </div>
                            <span className="text-gray-500 text-xs">
                                {timeAgo(d.startedAt)}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                            {d.project?.name && (
                                <span className="text-gray-400 font-medium">{d.project.name}</span>
                            )}
                            {d.project?.server?.name && (
                                <span className="text-gray-600">on {d.project.server.name}</span>
                            )}
                            {d.commitHash && (
                                <span className="font-mono">{d.commitHash.slice(0, 7)}</span>
                            )}
                            <span>{formatDuration(d.durationMs)}</span>
                            <span className="uppercase">{d.triggerSource}</span>
                            {d.deployUrl && d.status === 'SUCCESS' && (
                                <a href={d.deployUrl} target="_blank" rel="noreferrer" className="text-green-400 hover:underline truncate max-w-[120px]" title={d.deployUrl}>
                                    {d.deployUrl.replace('http://', '')}
                                </a>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

