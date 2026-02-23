"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth.provider";

interface AuditLog {
    id: string;
    action: string;
    userId: string | null;
    organizationId: string | null;
    ipAddress: string | null;
    metadata: string | null;
    createdAt: string;
}

export default function AdminActivityPage() {
    const { token } = useAuth();
    const [activity, setActivity] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        if (!token) return;

        const loadContent = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/admin/activity?page=${page}&limit=50`, {
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
    }, [token, page]);

    if (isLoading) return <div>Loading activity feed...</div>;
    if (error) return <div className="text-red-500">Error: {error}</div>;

    return (
        <div>
            <h1 className="text-3xl font-bold mb-8 text-white">Platform Activity Log</h1>

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
                                        {log.organizationId && <span className="mr-3">Org: <code className="text-gray-300">{log.organizationId}</code></span>}
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
