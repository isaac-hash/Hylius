"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth.provider";
import Link from "next/link";

interface UserWithRelations {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
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

    const loadContent = async () => {
        if (!token) return;
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

    useEffect(() => {
        loadContent();
    }, [token, page]);

    const toggleUserStatus = async (id: string, currentStatus: boolean) => {
        if (!token) return;
        try {
            const res = await fetch(`/api/admin/users/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ isActive: !currentStatus })
            });

            if (!res.ok) throw new Error('Failed to update status');

            // Reload logs/users
            loadContent();
        } catch (e: any) {
            alert(e.message);
        }
    };

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
                            <th className="px-6 py-4 font-medium">Status</th>
                            <th className="px-6 py-4 font-medium">Organization</th>
                            <th className="px-6 py-4 font-medium">Plan</th>
                            <th className="px-6 py-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800 bg-gray-950/50">
                        {users.map((u) => (
                            <tr key={u.id} className={`hover:bg-gray-900/50 transition-colors ${!u.isActive ? 'opacity-50' : ''}`}>
                                <td className="px-6 py-4 text-white">
                                    <div className="flex flex-col">
                                        <span>{u.email}</span>
                                        <span className="text-xs text-gray-500 font-mono">ID: {u.id}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs ${u.role === 'PLATFORM_ADMIN' ? 'bg-red-900/40 text-red-400 border border-red-800' :
                                        u.role === 'OWNER' ? 'bg-blue-900/40 text-blue-400 border border-blue-800' :
                                            'bg-gray-800 text-gray-300'
                                        }`}>
                                        {u.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${u.isActive ? 'bg-green-900/30 text-green-400 border border-green-800/50' : 'bg-red-900/30 text-red-400 border border-red-800/50'}`}>
                                        {u.isActive ? 'Active' : 'Disabled'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-bold text-gray-300">{u.organization?.name || '—'}</td>
                                <td className="px-6 py-4 text-xs font-mono">{u.organization?.plan || '—'}</td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-3">
                                        <Link href={`/admin/users/${u.id}`} className="text-blue-400 hover:text-blue-300 text-xs font-medium underline">
                                            Details
                                        </Link>
                                        <button
                                            onClick={() => toggleUserStatus(u.id, u.isActive)}
                                            className={`text-xs font-medium underline ${u.isActive ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}`}
                                        >
                                            {u.isActive ? 'Deactivate' : 'Reactivate'}
                                        </button>
                                    </div>
                                </td>
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
