"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth.provider";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface UserDetails {
    user: {
        id: string;
        email: string;
        role: string;
        isActive: boolean;
        createdAt: string;
        organization: {
            id: string;
            name: string;
            plan: string;
            _count: {
                projects: number;
                servers: number;
            }
        } | null;
        _count: {
            sessions: number;
        }
    };
    stats: {
        deploymentsCount: number;
        serversCount: number;
        projectsCount: number;
    };
    servers: Array<{ id: string; name: string; ip: string; createdAt: string }>;
    projects: Array<{ id: string; name: string; createdAt: string }>;
}

export default function UserDetailsPage() {
    const { token } = useAuth();
    const { id } = useParams();
    const router = useRouter();
    const [data, setData] = useState<UserDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token || !id) return;

        const loadContent = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/admin/users/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (!res.ok) throw new Error('Failed to fetch user details');
                const json = await res.json();
                setData(json);
            } catch (e: any) {
                setError(e.message);
            } finally {
                setIsLoading(false);
            }
        };

        loadContent();
    }, [token, id]);

    if (isLoading) return <div className="p-8 text-gray-400">Loading user info...</div>;
    if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
    if (!data) return <div className="p-8 text-gray-500">No user data found.</div>;

    const { user, stats, servers, projects } = data;

    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <h1 className="text-3xl font-bold text-white">User Details</h1>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${user.isActive ? 'bg-green-900/30 text-green-400 border border-green-800/50' : 'bg-red-900/30 text-red-400 border border-red-800/50'}`}>
                    {user.isActive ? 'Active Member' : 'Disabled Account'}
                </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Profile Card */}
                <div className="lg:col-span-1 space-y-8">
                    <div className="bg-gray-950 border border-gray-800 rounded-xl p-6 shadow-xl">
                        <div className="flex flex-col items-center text-center mb-6">
                            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-3xl font-bold mb-4 shadow-[0_0_20px_rgba(37,99,235,0.3)]">
                                {user.email[0].toUpperCase()}
                            </div>
                            <h2 className="text-xl font-bold text-white">{user.email}</h2>
                            <p className="text-sm text-gray-500 font-mono mt-1">ID: {user.id}</p>
                            <span className="mt-4 px-3 py-1 bg-gray-900 border border-gray-800 text-gray-300 text-xs rounded-full uppercase tracking-tighter">
                                {user.role}
                            </span>
                        </div>

                        <div className="space-y-4 pt-6 border-t border-gray-900">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Created</span>
                                <span className="text-gray-300">{new Date(user.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Total Sessions</span>
                                <span className="text-gray-300">{user._count.sessions}</span>
                            </div>
                        </div>
                    </div>

                    {/* Org Info */}
                    <div className="bg-gray-950/50 border border-gray-800 rounded-xl p-6">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Organization</h3>
                        {user.organization ? (
                            <div className="space-y-4">
                                <div>
                                    <p className="text-lg font-bold text-white">{user.organization.name}</p>
                                    <p className="text-xs text-gray-500 font-mono">Plan: {user.organization.plan}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-center">
                                    <div className="bg-black/30 p-3 rounded-lg border border-gray-900">
                                        <p className="text-xl font-bold text-white">{user.organization._count.servers}</p>
                                        <p className="text-[10px] text-gray-500 uppercase">Servers</p>
                                    </div>
                                    <div className="bg-black/30 p-3 rounded-lg border border-gray-900">
                                        <p className="text-xl font-bold text-white">{user.organization._count.projects}</p>
                                        <p className="text-[10px] text-gray-500 uppercase">Projects</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-600 italic">No organization assigned.</p>
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-6">
                        <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 p-6 rounded-xl shadow-lg">
                            <p className="text-3xl font-bold text-white mb-1">{stats.deploymentsCount}</p>
                            <p className="text-xs text-gray-500 uppercase tracking-wider">Total Deployments</p>
                        </div>
                        <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 p-6 rounded-xl shadow-lg">
                            <p className="text-3xl font-bold text-white mb-1">{stats.serversCount}</p>
                            <p className="text-xs text-gray-500 uppercase tracking-wider">Active Servers</p>
                        </div>
                        <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 p-6 rounded-xl shadow-lg">
                            <p className="text-3xl font-bold text-white mb-1">{stats.projectsCount}</p>
                            <p className="text-xs text-gray-500 uppercase tracking-wider">Managed Projects</p>
                        </div>
                    </div>

                    {/* Lists */}
                    <div className="space-y-6">
                        <section>
                            <h3 className="text-lg font-bold text-white mb-4">Infrastructure (Servers)</h3>
                            <div className="bg-gray-950 border border-gray-900 rounded-lg overflow-hidden">
                                {servers.length > 0 ? (
                                    <table className="w-full text-left text-sm text-gray-400">
                                        <thead className="bg-gray-900/50">
                                            <tr>
                                                <th className="px-4 py-3">Name</th>
                                                <th className="px-4 py-3">IP Address</th>
                                                <th className="px-4 py-3">Provisioned</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-900">
                                            {servers.map(s => (
                                                <tr key={s.id} className="hover:bg-blue-900/10 transition-colors">
                                                    <td className="px-4 py-3 text-white font-medium">{s.name}</td>
                                                    <td className="px-4 py-3 font-mono">{s.ip}</td>
                                                    <td className="px-4 py-3">{new Date(s.createdAt).toLocaleDateString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="p-8 text-center text-gray-600">No servers found.</div>
                                )}
                            </div>
                        </section>

                        <section>
                            <h3 className="text-lg font-bold text-white mb-4">Managed Projects</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {projects.map(p => (
                                    <div key={p.id} className="bg-gray-950 border border-gray-800 p-4 rounded-lg flex items-center justify-between hover:border-gray-600 transition-colors">
                                        <div>
                                            <p className="text-white font-bold">{p.name}</p>
                                            <p className="text-xs text-gray-500 mt-1">Created: {new Date(p.createdAt).toLocaleDateString()}</p>
                                        </div>
                                        <div className="text-xs font-mono text-gray-600">
                                            {p.id.substring(0, 8)}...
                                        </div>
                                    </div>
                                ))}
                                {projects.length === 0 && (
                                    <div className="col-span-2 bg-gray-950/30 border border-dashed border-gray-800 p-8 rounded-lg text-center text-gray-600">
                                        No projects tracked for this user.
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
