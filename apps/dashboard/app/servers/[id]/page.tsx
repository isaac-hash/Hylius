'use client';

import { useState, useEffect, useCallback, use } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { useAuth } from '@/providers/auth.provider';
import DeploymentHistory from '@/components/DeploymentHistory';
import AddProjectModal from '@/components/AddProjectModal';
import EditServerModal from '@/components/EditServerModal';

const ProvisionTerminalModal = dynamic(() => import('@/components/ProvisionTerminalModal'), {
    ssr: false,
});

const DeploymentTerminal = dynamic(() => import('@/components/DeploymentTerminal'), {
    ssr: false,
    loading: () => <div className="w-full h-[400px] bg-[#0d1117] rounded-lg border border-gray-800 flex items-center justify-center text-gray-500">Loading terminal...</div>
});

interface DetailedProject {
    id: string;
    name: string;
    repoUrl: string;
    branch: string;
    deployPath: string;
    buildCommand: string | null;
    startCommand: string | null;
    deployments: {
        id: string;
        status: string;
        startedAt: string;
    }[];
}

interface DetailedServer {
    id: string;
    name: string;
    ip: string;
    port: number;
    username: string;
    osType: string | null;
    createdAt: string;
    projects: DetailedProject[];
    metrics: { cpu: number; memory: number; disk: number; uptime: number; createdAt: string }[];
}

export default function ServerDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { user, logout, token } = useAuth();

    const [server, setServer] = useState<DetailedServer | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [provisionModalOpen, setProvisionModalOpen] = useState(false);
    const [addProjectModalOpen, setAddProjectModalOpen] = useState(false);
    const [editServerModalOpen, setEditServerModalOpen] = useState(false);
    const [activeDeployProjectId, setActiveDeployProjectId] = useState<string | null>(null);
    const [deletingProject, setDeletingProject] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const fetchServer = useCallback(() => {
        if (!token || !id) return;
        setLoading(true);
        fetch(`/api/servers/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(async (res) => {
                if (!res.ok) {
                    if (res.status === 404) throw new Error('Server not found');
                    throw new Error('Failed to load server details');
                }
                return res.json();
            })
            .then((data) => {
                setServer(data);
                setLoading(false);
            })
            .catch((err: Error) => {
                console.error(err);
                setError(err.message);
                setLoading(false);
            });
    }, [id, token, refreshKey]);

    useEffect(() => {
        if (token) fetchServer();
    }, [fetchServer, token]);

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to remove this server? All associated projects will remain but cannot be deployed.')) return;

        try {
            const res = await fetch(`/api/servers/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                router.push('/');
            } else {
                alert('Failed to delete server');
            }
        } catch (err: any) {
            alert(err.message || 'Failed to delete server');
        }
    };

    const handleDeleteProject = async (projectId: string, projectName: string) => {
        if (!confirm(`Are you sure you want to delete "${projectName}"? This action cannot be undone and will erase all deployment history.`)) {
            return;
        }

        setDeletingProject(projectId);
        try {
            const res = await fetch(`/api/projects/${projectId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete project');
            }

            // Refresh the server details to update the project list
            fetchServer();
        } catch (err: any) {
            alert(err.message || 'Failed to delete project');
        } finally {
            setDeletingProject(null);
        }
    };

    if (error) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center flex-col gap-4">
                <h1 className="text-2xl font-bold text-red-500">{error}</h1>
                <Link href="/" className="text-blue-400 hover:text-blue-300 underline">← Back to Dashboard</Link>
            </div>
        );
    }

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
                            <Link href="/" className="text-gray-400 hover:text-white transition-colors">Servers</Link>
                            <span className="text-gray-600">/</span>
                            <span className="text-gray-200">{server?.name || 'Loading...'}</span>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-gray-400">
                            <Link href="/deployments" className="hover:text-white transition-colors">Deployments</Link>
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

                <main className="max-w-7xl mx-auto px-6 py-8">
                    {loading && !server ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        </div>
                    ) : server && (
                        <div className="space-y-8">

                            {/* Header Section */}
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h1 className="text-3xl font-bold">{server.name}</h1>
                                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                                            Connected
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-400 font-mono">
                                        <span className="flex items-center gap-2"><svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{server.username}@{server.ip}:{server.port}</span>
                                        <span className="flex items-center gap-2"><svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>{server.osType || 'Linux (Auto-detected)'}</span>
                                        <span className="flex items-center gap-2"><svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>Added {new Date(server.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <button
                                        onClick={() => setProvisionModalOpen(true)}
                                        className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-[0_0_15px_rgba(37,99,235,0.3)] flex items-center justify-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        Provision Server
                                    </button>
                                    <button
                                        onClick={() => setEditServerModalOpen(true)}
                                        className="p-2.5 rounded-lg border border-gray-600/30 text-gray-300 hover:bg-gray-700/50 transition-colors"
                                        title="Edit Server"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        className="p-2.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                                        title="Delete Server"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>

                            {/* Server Dashboard Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                                {/* Main Content - Projects */}
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-xl font-bold flex items-center gap-2">
                                            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                            Projects ({server.projects.length})
                                        </h2>
                                        <button
                                            onClick={() => setAddProjectModalOpen(true)}
                                            className="bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 border border-gray-700"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                            Add Project
                                        </button>
                                    </div>

                                    {server.projects.length === 0 ? (
                                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-400">
                                            <p className="mb-2">No projects on this server yet.</p>
                                            <button
                                                onClick={() => setAddProjectModalOpen(true)}
                                                className="text-blue-400 hover:text-blue-300 text-sm underline"
                                            >
                                                Add your first project
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {server.projects.map((project) => (
                                                <div key={project.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden transition-all hover:border-gray-700">
                                                    <div className="p-5">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div>
                                                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                                                    {project.name}
                                                                    {project.deployments[0] && (
                                                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${project.deployments[0].status === 'SUCCESS' ? 'bg-green-500/10 text-green-400' :
                                                                            project.deployments[0].status === 'FAILED' ? 'bg-red-500/10 text-red-400' :
                                                                                'bg-blue-500/10 text-blue-400'
                                                                            }`}>
                                                                            {project.deployments[0].status}
                                                                        </span>
                                                                    )}
                                                                </h3>
                                                                <a href={project.repoUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-400 hover:underline flex items-center gap-1 mt-1">
                                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                                                                    {project.repoUrl.replace('https://github.com/', '')}#{project.branch}
                                                                </a>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => handleDeleteProject(project.id, project.name)}
                                                                    disabled={deletingProject === project.id}
                                                                    className="p-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                                                    title="Delete Project"
                                                                >
                                                                    {deletingProject === project.id ? (
                                                                        <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                                                                    ) : (
                                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                    )}
                                                                </button>
                                                                <button
                                                                    onClick={() => setActiveDeployProjectId(project.id)}
                                                                    disabled={activeDeployProjectId !== null || deletingProject !== null}
                                                                    className={`bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-[0_0_10px_rgba(22,163,74,0.3)] flex items-center gap-2 ${activeDeployProjectId !== null || deletingProject !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                    {activeDeployProjectId === project.id ? 'Deploying...' : 'Deploy Now'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-400 font-mono bg-black/30 p-3 rounded-lg border border-gray-800/80">
                                                            <div>
                                                                <span className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Deploy Path</span>
                                                                {project.deployPath}
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Build / Start Commands</span>
                                                                <div className="truncate">B: {project.buildCommand || 'auto'}</div>
                                                                <div className="truncate">S: {project.startCommand || 'auto'}</div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Active Deployment Terminal Dropdown inline */}
                                                    {activeDeployProjectId === project.id && (
                                                        <div className="border-t border-gray-800 bg-black p-4">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <h4 className="text-sm font-semibold flex items-center gap-2 text-white">
                                                                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                                                                    Live Deployment Console
                                                                </h4>
                                                                <button
                                                                    onClick={() => {
                                                                        setActiveDeployProjectId(null);
                                                                        setRefreshKey(k => k + 1); // Refresh page data on terminal close
                                                                    }}
                                                                    className="text-xs text-gray-400 hover:text-white"
                                                                >
                                                                    Close Terminal
                                                                </button>
                                                            </div>
                                                            <DeploymentTerminal
                                                                projectId={project.id}
                                                                active={true}
                                                                onDeployFinished={() => {
                                                                    setRefreshKey(k => k + 1);
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Right Sidebar - Metrics & History */}
                                <div className="space-y-6">
                                    {/* Metrics (Mocked visual for now until agent script added) */}
                                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Live Metrics</h3>
                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex justify-between text-sm mb-1"><span>CPU Usage</span><span className="font-mono text-gray-400">--%</span></div>
                                                <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-blue-500 w-[0%]"></div></div>
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-sm mb-1"><span>Memory</span><span className="font-mono text-gray-400">--%</span></div>
                                                <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-purple-500 w-[0%]"></div></div>
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-sm mb-1"><span>Storage</span><span className="font-mono text-gray-400">--%</span></div>
                                                <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-green-500 w-[0%]"></div></div>
                                            </div>
                                            <p className="text-xs text-gray-500 italic mt-2">Server metrics agent coming soon.</p>
                                        </div>
                                    </div>

                                    {/* Recent Deployments across all projects on this server */}
                                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Recent Deployments</h3>
                                        {/* We reuse the DeploymentHistory component but we would need to scope it to the server. For now, since a user is viewing server projects, we show the history for the first project, or if we want server-wide we would need a new endpoint. Let's pass the first project ID for now or null */}
                                        <DeploymentHistory refreshKey={refreshKey} />
                                        <p className="text-xs text-gray-500 mt-4 text-center">Showing latest org deployments.</p>
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}
                </main>

                <ProvisionTerminalModal
                    isOpen={provisionModalOpen}
                    onClose={() => setProvisionModalOpen(false)}
                    serverId={server?.id || ''}
                    serverName={server?.name || ''}
                />

                <AddProjectModal
                    isOpen={addProjectModalOpen}
                    onClose={() => setAddProjectModalOpen(false)}
                    serverId={server?.id || ''}
                    serverName={server?.name || ''}
                    onAdded={() => {
                        setAddProjectModalOpen(false);
                        setRefreshKey(k => k + 1); // Refresh server details to show new project
                    }}
                />

                <EditServerModal
                    isOpen={editServerModalOpen}
                    onClose={() => setEditServerModalOpen(false)}
                    onUpdated={() => {
                        setRefreshKey(k => k + 1);
                    }}
                    server={server}
                />
            </div>
        </AuthGuard>
    );
}
