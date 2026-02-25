'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import DeploymentHistory from '@/components/DeploymentHistory';
import Link from 'next/link';

const DeploymentTerminal = dynamic(() => import('@/components/DeploymentTerminal'), {
    ssr: false,
    loading: () => <div className="w-full h-[400px] bg-[#0d1117] rounded-lg border border-gray-800 flex items-center justify-center text-gray-500">Loading terminal...</div>
});

interface Project {
    id: string;
    name: string;
    repoUrl: string;
    branch: string;
    server?: { name: string };
}

import { AuthGuard } from '@/components/AuthGuard';
import { useAuth } from '@/providers/auth.provider';

export default function DeploymentPage() {
    const { user, logout, token } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [isDeploying, setIsDeploying] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchProjects = useCallback(() => {
        if (!token) return;
        fetch('/api/projects', {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    setProjects(data);
                    setSelectedProjectId(prev => (data.length > 0 && !prev) ? data[0].id : prev);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [token]);

    useEffect(() => {
        if (token) fetchProjects();
    }, [fetchProjects, token]);

    const handleDeployNow = () => {
        if (!selectedProjectId) return;
        setIsDeploying(true);
    };

    const handleDeployFinished = useCallback(() => {
        // Refresh deployment history after completion
        setRefreshKey((k) => k + 1);
        setIsDeploying(false); // End the deployment state so the user can deploy again
    }, []);

    const selectedProject = projects.find((p) => p.id === selectedProjectId);

    return (
        <AuthGuard>
            <div className="min-h-screen bg-black text-white">
                {/* Navbar */}
                <nav className="border-b border-gray-800 bg-black/50 backdrop-blur-md sticky top-0 z-10">
                    <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold">H</div>
                                <span className="font-bold text-xl tracking-tight">Hylius</span>
                            </Link>
                            <span className="text-gray-600">/</span>
                            <span className="text-gray-400">Deployments</span>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-gray-400">
                            <Link href="/" className="hover:text-white transition-colors">Servers</Link>

                            <div className="flex items-center gap-3 pl-4 border-l border-gray-800">
                                <span className="text-gray-300">{user?.email}</span>
                                <button
                                    onClick={logout}
                                    className="px-3 py-1.5 rounded-md bg-gray-900 border border-gray-800 hover:bg-gray-800 hover:text-white transition-colors text-xs"
                                >
                                    Logout
                                </button>
                            </div>
                        </div>
                    </div>
                </nav>

                <main className="max-w-7xl mx-auto px-6 py-12">
                    <header className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-2xl font-bold mb-1">Deployments</h1>
                            <p className="text-gray-400 text-sm">Real-time deployment logs and history.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Project Selector */}
                            {projects.length > 0 && (
                                <select
                                    value={selectedProjectId}
                                    onChange={(e) => {
                                        setSelectedProjectId(e.target.value);
                                        setIsDeploying(false);
                                    }}
                                    className="bg-gray-900 border border-gray-800 rounded-md px-3 py-2 text-sm text-white focus:border-blue-600 focus:outline-none transition-colors"
                                >
                                    {projects.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} {p.server ? `(${p.server.name})` : ''}
                                        </option>
                                    ))}
                                </select>
                            )}
                            <button
                                onClick={handleDeployNow}
                                disabled={!selectedProjectId || isDeploying}
                                className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {isDeploying ? 'Deploying...' : 'Deploy Now'}
                            </button>
                        </div>
                    </header>

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        </div>
                    ) : projects.length === 0 ? (
                        <div className="text-center py-20 bg-gray-900/50 rounded-lg border border-gray-800">
                            <div className="text-4xl mb-4">🚀</div>
                            <p className="text-gray-400 mb-2">No projects yet</p>
                            <p className="text-gray-500 text-sm mb-4">
                                Add a server, then create a project to start deploying.
                            </p>
                            <Link
                                href="/"
                                className="text-blue-400 hover:text-blue-300 underline text-sm"
                            >
                                Go to Servers →
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Terminal - 2/3 width */}
                            <div className="lg:col-span-2">
                                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                    Live Console
                                    {isDeploying && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-green-400 bg-green-500/10">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5 animate-pulse"></span>
                                            LIVE
                                        </span>
                                    )}
                                </h3>

                                {isDeploying ? (
                                    <DeploymentTerminal
                                        projectId={selectedProjectId}
                                        active={true}
                                        onDeployFinished={handleDeployFinished}
                                    />
                                ) : (
                                    <div className="w-full h-[400px] bg-[#0d1117] rounded-lg border border-gray-800 flex items-center justify-center">
                                        <div className="text-center">
                                            <p className="text-gray-500 mb-2">No active deployment</p>
                                            <p className="text-gray-600 text-sm">
                                                {selectedProject
                                                    ? `Click "Deploy Now" to deploy ${selectedProject.name}`
                                                    : 'Select a project to get started'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* History Sidebar - 1/3 width */}
                            <div>
                                <h3 className="text-lg font-semibold mb-3">Recent Deployments</h3>
                                <DeploymentHistory
                                    projectId={selectedProjectId}
                                    refreshKey={refreshKey}
                                />
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </AuthGuard>
    );
}
