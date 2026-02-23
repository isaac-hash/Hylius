"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth.provider";

interface UserWithRelations {
    id: string;
    email: string;
    role: string;
    createdAt: string;
    organization: {
        id: string;
        name: string;
        plan: string;
    } | null;
    _count: {
        sessions: number;
    }
}

export default function AdminUsersPage() {
    const { token } = useAuth();
    const [users, setUsers] = useState<UserWithRelations[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        if (!token) return;

        const loadContent = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/admin/users?page=${page}&limit=20`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (!res.ok) throw new Error('Failed to fetch data');
                const data = await res.json();

                setUsers(data.users);
                setTotalPages(data.pagination.totalPages);
            } catch (e: any) {
                setError(e.message);
            } finally {
                setIsLoading(false);
            }
        };

        loadContent();
    }, [token, page]);

    if (isLoading) return <div>Loading users...</div>;
    if (error) return <div className="text-red-500">Error: {error}</div>;

    return (
        <div>
            <h1 className="text-3xl font-bold mb-8 text-white">All Users</h1>

            <div className="border border-gray-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm text-gray-400">
                    <thead className="bg-gray-900 text-gray-300">
                        <tr>
                            <th className="px-6 py-4 font-medium">Email</th>
                            <th className="px-6 py-4 font-medium">Role</th>
                            <th className="px-6 py-4 font-medium">Organization</th>
                            <th className="px-6 py-4 font-medium">Plan</th>
                            <th className="px-6 py-4 font-medium">Sessions</th>
                            <th className="px-6 py-4 font-medium">Joined</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800 bg-gray-950/50">
                        {users.map((u) => (
                            <tr key={u.id} className="hover:bg-gray-900/50 transition-colors">
                                <td className="px-6 py-4 text-white">{u.email}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs ${u.role === 'PLATFORM_ADMIN' ? 'bg-red-900/40 text-red-400 border border-red-800' :
                                        u.role === 'OWNER' ? 'bg-blue-900/40 text-blue-400 border border-blue-800' :
                                            'bg-gray-800 text-gray-300'
                                        }`}>
                                        {u.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4">{u.organization?.name || '—'}</td>
                                <td className="px-6 py-4 text-xs font-mono">{u.organization?.plan || '—'}</td>
                                <td className="px-6 py-4">{u._count.sessions}</td>
                                <td className="px-6 py-4 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-md hover:bg-gray-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed text-white"
                    >
                        Previous
                    </button>
                    <span className="text-gray-400 text-sm">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-md hover:bg-gray-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed text-white"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
