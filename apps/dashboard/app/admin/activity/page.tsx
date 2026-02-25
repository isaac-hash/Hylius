"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth.provider";

interface AuditLog {
    id: string;
    action: string;
    userId: string | null;
    organizationId: string | null;
    organization?: {
        name: string;
    };
    ipAddress: string | null;
    metadata: string | null;
    createdAt: string;
}

interface Organization {
    id: string;
    name: string;
}

export default function AdminActivityPage() {
    const { token } = useAuth();
    const [activity, setActivity] = useState<AuditLog[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedOrg, setSelectedOrg] = useState('');
    const [selectedAction, setSelectedAction] = useState('');

    const ACTIONS = [
        'SERVER_CREATED',
        'SERVER_PROVISION_STARTED',
        'SERVER_PROVISION_COMPLETED',
        'SERVER_PROVISION_FAILED',
        'PROJECT_CREATED',
        'DEPLOYMENT_STARTED',
        'DEPLOYMENT_COMPLETED',
        'DEPLOYMENT_FAILED',
        'SUBSCRIPTION_DETERMINED'
    ];

    useEffect(() => {
        if (!token) return;

        const loadOrgs = async () => {
            try {
                const res = await fetch('/api/admin/organizations?limit=100', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setOrganizations(data.organizations);
                }
            } catch (e) {
                console.error('Failed to load organizations', e);
            }
        };

        loadOrgs();
    }, [token]);

    useEffect(() => {
        if (!token) return;

        const loadContent = async () => {
            setIsLoading(true);
            try {
                let url = `/api/admin/activity?page=${page}&limit=50`;
                if (selectedOrg) url += `&orgId=${selectedOrg}`;
                if (selectedAction) url += `&action=${selectedAction}`;

                const res = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (!res.ok) throw new Error('Failed to fetch data');
                const data = await res.json();

                setActivity(data.activity);
                setTotalPages(data.pagination.totalPages);
            } catch (e: any) {
                setError(e.message);
            } finally {
                setIsLoading(false);
            }
        };

        loadContent();
    }, [token, page, selectedOrg, selectedAction]);

    if (isLoading) return <div>Loading activity feed...</div>;
    if (error) return <div className="text-red-500">Error: {error}</div>;

    return (
        <div>
            <h1 className="text-3xl font-bold mb-8 text-white">Platform Activity Log</h1>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1">
                    <label className="block text-xs text-gray-500 uppercase mb-1">Filter by Organization</label>
                    <select
                        value={selectedOrg}
                        onChange={(e) => { setSelectedOrg(e.target.value); setPage(1); }}
                        className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
                    >
                        <option value="">All Organizations</option>
                        {organizations.map(org => (
                            <option key={org.id} value={org.id}>{org.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex-1">
                    <label className="block text-xs text-gray-500 uppercase mb-1">Filter by Action</label>
                    <select
                        value={selectedAction}
                        onChange={(e) => { setSelectedAction(e.target.value); setPage(1); }}
                        className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
                    >
                        <option value="">All Actions</option>
                        {ACTIONS.map(action => (
                            <option key={action} value={action}>{action}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-end">
                    {(selectedOrg || selectedAction) && (
                        <button
                            onClick={() => { setSelectedOrg(''); setSelectedAction(''); setPage(1); }}
                            className="text-xs text-blue-400 hover:text-blue-300 underline py-2"
                        >
                            Reset Filters
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-gray-950/50 border border-gray-800 rounded-lg overflow-hidden">
                <ul className="divide-y divide-gray-800">
                    {activity.map((log) => (
                        <li key={log.id} className="p-4 hover:bg-gray-900 transition-colors">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="inline-block px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded-sm mb-2 font-mono">
                                        {log.action}
                                    </span>
                                    <div className="text-sm text-gray-400 mt-1">
                                        {log.organizationId && (
                                            <span className="mr-3">
                                                Org: <code className="text-gray-300 font-bold">{log.organization?.name || log.organizationId}</code>
                                            </span>
                                        )}
                                        {log.userId && <span>User: <code className="text-gray-300">{log.userId}</code></span>}
                                    </div>
                                    {log.metadata && (
                                        <div className="mt-2 text-xs font-mono text-gray-500 bg-black/40 p-2 rounded">
                                            {log.metadata}
                                        </div>
                                    )}
                                </div>
                                <div className="text-xs text-gray-500 whitespace-nowrap">
                                    {new Date(log.createdAt).toLocaleString()}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>

                {activity.length === 0 && (
                    <div className="p-8 text-center text-gray-500">No activity logs found.</div>
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-md hover:bg-gray-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed text-white"
                    >
                        Newer
                    </button>
                    <span className="text-gray-400 text-sm">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-md hover:bg-gray-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed text-white"
                    >
                        Older
                    </button>
                </div>
            )}
        </div>
    );
}
