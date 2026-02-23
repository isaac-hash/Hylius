"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth.provider";

interface OrganizationWithRelations {
    id: string;
    name: string;
    slug: string;
    plan: string;
    createdAt: string;
    _count: {
        users: number;
        projects: number;
        servers: number;
    }
}

export default function AdminOrganizationsPage() {
    const { token } = useAuth();
    const [organizations, setOrganizations] = useState<OrganizationWithRelations[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        if (!token) return;

        const loadContent = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/admin/organizations?page=${page}&limit=20`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (!res.ok) throw new Error('Failed to fetch data');
                const data = await res.json();

                setOrganizations(data.organizations);
                setTotalPages(data.pagination.totalPages);
            } catch (e: any) {
                setError(e.message);
            } finally {
                setIsLoading(false);
            }
        };

        loadContent();
    }, [token, page]);

    if (isLoading) return <div>Loading organizations...</div>;
    if (error) return <div className="text-red-500">Error: {error}</div>;

    return (
        <div>
            <h1 className="text-3xl font-bold mb-8 text-white">Organizations</h1>

            <div className="border border-gray-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm text-gray-400">
                    <thead className="bg-gray-900 text-gray-300">
                        <tr>
                            <th className="px-6 py-4 font-medium">Name</th>
                            <th className="px-6 py-4 font-medium">Slug</th>
                            <th className="px-6 py-4 font-medium">Plan</th>
                            <th className="px-6 py-4 font-medium">Users</th>
                            <th className="px-6 py-4 font-medium">Servers</th>
                            <th className="px-6 py-4 font-medium">Projects</th>
                            <th className="px-6 py-4 font-medium">Created</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800 bg-gray-950/50">
                        {organizations.map((org) => (
                            <tr key={org.id} className="hover:bg-gray-900/50 transition-colors">
                                <td className="px-6 py-4 text-white font-medium">{org.name}</td>
                                <td className="px-6 py-4 font-mono text-xs">{org.slug}</td>
                                <td className="px-6 py-4 text-xs font-mono">
                                    <span className={`px-2 py-1 rounded-sm ${org.plan === 'PRO' ? 'bg-purple-900/30 text-purple-400 border border-purple-800/50' :
                                        'bg-gray-800 text-gray-300'
                                        }`}>
                                        {org.plan}
                                    </span>
                                </td>
                                <td className="px-6 py-4">{org._count.users}</td>
                                <td className="px-6 py-4">{org._count.servers}</td>
                                <td className="px-6 py-4">{org._count.projects}</td>
                                <td className="px-6 py-4 text-gray-500">{new Date(org.createdAt).toLocaleDateString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

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
