"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { useAuth } from "@/providers/auth.provider";
import io from "socket.io-client";

interface StackDetail {
    id: string;
    name: string;
    description: string | null;
    status: string;
    server: { id: string; name: string; ip: string; status: string };
    projects: Array<{
        id: string;
        name: string;
        deployStrategy: string | null;
        repoUrl: string;
        role: string | null;
        deployments: Array<{
            id: string;
            status: string;
            deployUrl: string | null;
            startedAt: string;
            finishedAt: string | null;
        }>;
        _count: { deployments: number };
    }>;
    databases: Array<{
        id: string;
        name: string;
        engine: string;
        status: string;
        containerName: string | null;
        port: number | null;
    }>;
}

interface ServiceProgress {
    type: 'service_start' | 'service_complete' | 'service_error';
    projectId: string;
    projectName: string;
    index: number;
    total: number;
    success?: boolean;
    error?: string;
    url?: string;
}

function getServiceStatus(project: StackDetail['projects'][0]) {
    const lastDeploy = project.deployments[0];
    if (!lastDeploy) return { label: 'Not deployed', color: 'text-gray-500', dot: 'bg-gray-600' };
    switch (lastDeploy.status) {
        case 'SUCCESS': return { label: 'Healthy', color: 'text-green-400', dot: 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]' };
        case 'BUILDING': case 'PENDING': return { label: 'Deploying', color: 'text-blue-400', dot: 'bg-blue-400 animate-pulse' };
        case 'FAILED': return { label: 'Failed', color: 'text-red-400', dot: 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]' };
        default: return { label: lastDeploy.status, color: 'text-gray-400', dot: 'bg-gray-500' };
    }
}

function getStrategyLabel(strategy: string | null) {
    switch (strategy) {
        case 'dagger': return 'Dagger';
        case 'docker-compose': case 'compose-server': return 'Compose';
        case 'compose-registry': return 'Compose (CI)';
        case 'ghcr-pull': return 'GHCR';
        case 'railpack': return 'Railpack';
        case 'nixpacks': return 'Nixpacks';
        case 'pm2': return 'PM2';
        default: return 'Auto';
    }
}

function getEngineIcon(engine: string) {
    switch (engine.toUpperCase()) {
        case 'POSTGRES': return '🐘';
        case 'MYSQL': return '🐬';
        case 'REDIS': return '🔴';
        default: return '💾';
    }
}

export default function StackDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { token, user } = useAuth();
    const [stack, setStack] = useState<StackDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Deploy All state
    const [deploying, setDeploying] = useState(false);
    const [deployLogs, setDeployLogs] = useState('');
    const [serviceProgress, setServiceProgress] = useState<ServiceProgress[]>([]);
    const [showLogs, setShowLogs] = useState(false);
    const logRef = useRef<HTMLPreElement>(null);

    // Edit state
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');

    // Delete state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteWipe, setDeleteWipe] = useState(false);

    const fetchStack = useCallback(async () => {
        try {
            const res = await fetch(`/api/stacks/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Stack not found');
            const data = await res.json();
            setStack(data);
            setEditName(data.name);
            setEditDesc(data.description || '');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [id, token]);

    useEffect(() => {
        if (token && id) fetchStack();
    }, [token, id, fetchStack]);

    // Auto-scroll logs
    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [deployLogs]);

    function handleDeployAll() {
        if (!stack || deploying) return;

        setDeploying(true);
        setDeployLogs('');
        setServiceProgress([]);
        setShowLogs(true);

        const socket = io();

        socket.emit('deploy-stack', {
            stackId: stack.id,
            organizationId: (user as any)?.organizationId,
        });

        socket.on(`stack_log:${stack.id}`, (chunk: string) => {
            setDeployLogs(prev => prev + chunk);
        });

        socket.on(`stack_service_progress:${stack.id}`, (event: ServiceProgress) => {
            setServiceProgress(prev => {
                const existing = prev.findIndex(p => p.projectId === event.projectId && p.type === event.type);
                if (existing >= 0) {
                    const updated = [...prev];
                    updated[existing] = event;
                    return updated;
                }
                return [...prev, event];
            });
        });

        socket.on(`stack_deploy_success:${stack.id}`, () => {
            setDeploying(false);
            fetchStack();
            socket.disconnect();
        });

        socket.on(`stack_deploy_error:${stack.id}`, () => {
            setDeploying(false);
            fetchStack();
            socket.disconnect();
        });
    }

    async function handleSaveEdit() {
        try {
            await fetch(`/api/stacks/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ name: editName, description: editDesc || null }),
            });
            setEditing(false);
            fetchStack();
        } catch {
            alert('Failed to update stack');
        }
    }

    async function handleRemoveService(projectId: string) {
        if (!confirm('Remove this service from the stack?')) return;
        try {
            await fetch(`/api/stacks/${id}/services?projectId=${projectId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchStack();
        } catch {
            alert('Failed to remove service');
        }
    }

    async function handleRemoveDatabase(databaseId: string) {
        if (!confirm('Remove this database from the stack?')) return;
        try {
            await fetch(`/api/stacks/${id}/databases?databaseId=${databaseId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchStack();
        } catch {
            alert('Failed to remove database');
        }
    }

    async function confirmDeleteStack() {
        try {
            await fetch(`/api/stacks/${id}?wipe=${deleteWipe}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            router.push('/stacks');
        } catch {
            alert('Failed to delete stack');
        }
    }

    if (loading) {
        return (
            <AuthGuard>
                <div className="flex items-center justify-center py-20 text-gray-500">
                    <div className="w-6 h-6 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin mr-3" />
                    Loading stack...
                </div>
            </AuthGuard>
        );
    }

    if (error || !stack) {
        return (
            <AuthGuard>
                <div className="text-center py-20">
                    <p className="text-red-400 mb-4">{error || 'Stack not found'}</p>
                    <Link href="/stacks" className="text-blue-400 hover:text-blue-300 text-sm">← Back to Stacks</Link>
                </div>
            </AuthGuard>
        );
    }

    const healthyCount = stack.projects.filter(p => p.deployments[0]?.status === 'SUCCESS').length;
    const totalServices = stack.projects.length;

    return (
        <AuthGuard>
            <div className="min-h-screen bg-background text-foreground selection:bg-blue-500/30">
                <main className="py-6">
                    {/* Breadcrumb */}
                    <div className="mb-6 animate-reveal">
                        <Link href="/stacks" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                            ← Stacks
                        </Link>
                    </div>

                    {/* Header */}
                    <header className="mb-8 animate-reveal">
                        <div className="flex items-start justify-between">
                            <div>
                                {editing ? (
                                    <div className="flex items-center gap-3 mb-2">
                                        <input
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            className="bg-black border border-gray-700 rounded-lg px-3 py-2 text-white text-2xl font-bold focus:border-blue-500 focus:outline-none"
                                        />
                                        <button onClick={handleSaveEdit} className="text-xs text-green-400 hover:text-green-300">Save</button>
                                        <button onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
                                    </div>
                                ) : (
                                    <h1
                                        className="font-display text-3xl font-bold tracking-tight text-white cursor-pointer hover:text-gray-200 transition-colors"
                                        onClick={() => setEditing(true)}
                                        title="Click to edit"
                                    >
                                        {stack.name}
                                    </h1>
                                )}
                                {editing ? (
                                    <input
                                        value={editDesc}
                                        onChange={e => setEditDesc(e.target.value)}
                                        placeholder="Add a description..."
                                        className="bg-black border border-gray-800 rounded-lg px-3 py-1.5 text-gray-400 text-sm mt-1 w-80 focus:border-blue-500 focus:outline-none"
                                    />
                                ) : (
                                    <p className="text-gray-500 mt-1">{stack.description || 'No description'}</p>
                                )}

                                {/* Health summary */}
                                <div className="mt-5 space-y-3">
                                    <h3 className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Stack Health</h3>
                                    <div className="flex flex-wrap items-center gap-3">
                                        {stack.projects.map(p => {
                                            const { label, color, dot } = getServiceStatus(p);
                                            return (
                                                <div key={p.id} className="bg-gray-800/40 border border-gray-700/50 rounded-lg px-3 py-1.5 flex items-center gap-2">
                                                    <span className="text-xs text-gray-300 font-medium capitalize">{p.role || 'Service'}</span>
                                                    <div className={`w-2 h-2 rounded-full ${dot}`} />
                                                    <span className={`text-xs ${color}`}>{label}</span>
                                                </div>
                                            );
                                        })}
                                        {stack.databases.map(db => (
                                            <div key={db.id} className="bg-gray-800/40 border border-gray-700/50 rounded-lg px-3 py-1.5 flex items-center gap-2">
                                                <span className="text-xs text-gray-300 font-medium">Database</span>
                                                <div className={`w-2 h-2 rounded-full ${db.status === 'RUNNING' ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]' : 'bg-gray-500'}`} />
                                                <span className={`text-xs ${db.status === 'RUNNING' ? 'text-green-400' : 'text-gray-400'}`}>{db.status === 'RUNNING' ? 'Connected' : db.status}</span>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    <span className="inline-flex text-xs text-gray-500 bg-gray-800/30 px-2 py-1 rounded-md items-center gap-1.5 mt-2 border border-gray-800/50">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                                            <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                                        </svg>
                                        Deployed on {stack.server.name} ({stack.server.ip})
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleDeployAll}
                                    disabled={deploying || stack.projects.length === 0}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40 shadow-lg shadow-blue-500/20 flex items-center gap-2"
                                >
                                    {deploying ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Deploying...
                                        </>
                                    ) : (
                                        <>🚀 Deploy All</>
                                    )}
                                </button>
                                <button
                                    onClick={() => setShowDeleteModal(true)}
                                    className="text-sm text-gray-500 hover:text-red-400 px-3 py-2.5 rounded-xl hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/20"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </header>

                    {/* Deploy Progress (when deploying) */}
                    {serviceProgress.length > 0 && (
                        <div className="mb-6 bg-gray-900/60 border border-gray-800 rounded-2xl p-5 animate-reveal">
                            <h3 className="text-sm font-semibold text-white mb-3">Deploy Progress</h3>
                            <div className="space-y-2">
                                {stack.projects.map((project, i) => {
                                    const started = serviceProgress.find(p => p.projectId === project.id && p.type === 'service_start');
                                    const completed = serviceProgress.find(p => p.projectId === project.id && (p.type === 'service_complete' || p.type === 'service_error'));

                                    let status = 'pending';
                                    if (completed) status = completed.success ? 'success' : 'error';
                                    else if (started) status = 'deploying';

                                    return (
                                        <div key={project.id} className="flex items-center gap-3 py-1.5">
                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                                                status === 'success' ? 'bg-green-500/20 text-green-400' :
                                                status === 'error' ? 'bg-red-500/20 text-red-400' :
                                                status === 'deploying' ? 'bg-blue-500/20 text-blue-400' :
                                                'bg-gray-800 text-gray-600'
                                            }`}>
                                                {status === 'success' ? '✓' :
                                                 status === 'error' ? '✕' :
                                                 status === 'deploying' ? (
                                                    <span className="w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                                                 ) : (i + 1)}
                                            </div>
                                            <span className={`text-sm ${
                                                status === 'success' ? 'text-green-400' :
                                                status === 'error' ? 'text-red-400' :
                                                status === 'deploying' ? 'text-white' :
                                                'text-gray-600'
                                            }`}>
                                                {project.name}
                                            </span>
                                            {completed?.url && (
                                                <a href={completed.url} target="_blank" rel="noopener" className="text-xs text-blue-400 hover:text-blue-300 ml-auto">
                                                    {completed.url}
                                                </a>
                                            )}
                                            {completed?.error && (
                                                <span className="text-xs text-red-400 ml-auto truncate max-w-xs">{completed.error}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Services */}
                    <section className="mb-8 animate-reveal">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-white">Services</h2>
                        </div>

                        {stack.projects.length === 0 ? (
                            <div className="text-center py-10 bg-gray-900/30 border border-gray-800 border-dashed rounded-2xl">
                                <p className="text-gray-500 text-sm">No services in this stack yet</p>
                                <p className="text-gray-600 text-xs mt-1">Add existing projects from the server detail page</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Visual connection line */}
                                {stack.projects.map((project, i) => {
                                    const { label, color, dot } = getServiceStatus(project);
                                    const lastDeploy = project.deployments[0];

                                    return (
                                        <div key={project.id} className="relative">
                                            {/* Connector line */}
                                            {i < stack.projects.length - 1 && (
                                                <div className="absolute left-7 top-full w-px h-3 bg-gray-800 z-0" />
                                            )}

                                            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all relative z-10">
                                                <div className="flex items-center gap-4">
                                                    {/* Status dot */}
                                                    <div className="flex flex-col items-center">
                                                        <div className={`w-3 h-3 rounded-full ${dot}`} />
                                                    </div>

                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-white font-medium text-sm">{project.name}</span>
                                                            <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
                                                                {getStrategyLabel(project.deployStrategy)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <span className={`text-xs ${color}`}>{label}</span>
                                                            {lastDeploy?.deployUrl && (
                                                                <a href={lastDeploy.deployUrl} target="_blank" rel="noopener" className="text-xs text-blue-400 hover:text-blue-300 truncate max-w-[200px]">
                                                                    {lastDeploy.deployUrl}
                                                                </a>
                                                            )}
                                                            <span className="text-xs text-gray-600">
                                                                {project._count.deployments} deploy{project._count.deployments !== 1 ? 's' : ''}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-1">
                                                        <Link
                                                            href={`/servers/${stack.server.id}`}
                                                            className="text-xs text-gray-500 hover:text-white px-2 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                                                            title="View project logs"
                                                        >
                                                            Logs
                                                        </Link>
                                                        <button
                                                            onClick={() => handleRemoveService(project.id)}
                                                            className="text-xs text-gray-600 hover:text-red-400 px-2 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                                                            title="Remove from stack"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {/* Databases */}
                    <section className="mb-8 animate-reveal">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-white">Databases</h2>
                        </div>

                        {stack.databases.length === 0 ? (
                            <div className="text-center py-10 bg-gray-900/30 border border-gray-800 border-dashed rounded-2xl">
                                <p className="text-gray-500 text-sm">No databases in this stack</p>
                                <p className="text-gray-600 text-xs mt-1">Link existing databases from the server detail page</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {stack.databases.map(db => (
                                    <div key={db.id} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl">{getEngineIcon(db.engine)}</span>
                                                <div>
                                                    <span className="text-white text-sm font-medium">{db.name}</span>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-xs text-gray-600">{db.engine}</span>
                                                        {db.port && <span className="text-xs text-gray-600">Port: {db.port}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs px-1.5 py-0.5 rounded border ${
                                                    db.status === 'RUNNING'
                                                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                                        : 'bg-gray-800 text-gray-500 border-gray-700'
                                                }`}>
                                                    {db.status}
                                                </span>
                                                <button
                                                    onClick={() => handleRemoveDatabase(db.id)}
                                                    className="text-xs text-gray-600 hover:text-red-400 px-1.5 py-1 rounded hover:bg-red-500/10 transition-colors"
                                                    title="Remove from stack"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Deploy Logs Terminal */}
                    {showLogs && (
                        <section className="animate-reveal">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-lg font-semibold text-white">Deploy Logs</h2>
                                <button
                                    onClick={() => setShowLogs(false)}
                                    className="text-xs text-gray-500 hover:text-white transition-colors"
                                >
                                    Hide
                                </button>
                            </div>
                            <pre
                                ref={logRef}
                                className="bg-black border border-gray-800 rounded-xl p-4 text-xs text-gray-300 font-mono overflow-auto max-h-[500px] whitespace-pre-wrap"
                            >
                                {deployLogs || 'Waiting for logs...'}
                            </pre>
                        </section>
                    )}
                </main>
            </div>

            {/* Delete Stack Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-2">Delete Stack</h2>
                        <p className="text-sm text-gray-400 mb-6">How do you want to handle the resources inside this stack?</p>

                        <div className="space-y-3 mb-6">
                            <label className={`block p-4 rounded-xl border cursor-pointer transition-all ${!deleteWipe ? 'border-blue-500 bg-blue-500/10' : 'border-gray-800 bg-black/50 hover:border-gray-600'}`}>
                                <div className="flex items-center gap-3">
                                    <input type="radio" checked={!deleteWipe} onChange={() => setDeleteWipe(false)} className="text-blue-500 focus:ring-blue-500 bg-black border-gray-700" />
                                    <div>
                                        <div className="text-sm font-medium text-white">Unlink Only (Safe)</div>
                                        <div className="text-xs text-gray-400 mt-0.5">Stack is deleted, but services and databases keep running normally.</div>
                                    </div>
                                </div>
                            </label>

                            <label className={`block p-4 rounded-xl border cursor-pointer transition-all ${deleteWipe ? 'border-red-500 bg-red-500/10' : 'border-gray-800 bg-black/50 hover:border-gray-600'}`}>
                                <div className="flex items-center gap-3">
                                    <input type="radio" checked={deleteWipe} onChange={() => setDeleteWipe(true)} className="text-red-500 focus:ring-red-500 bg-black border-gray-700" />
                                    <div>
                                        <div className="text-sm font-medium text-red-400">Complete Wipe (Destructive)</div>
                                        <div className="text-xs text-red-400/70 mt-0.5">Stack, all projects, and all databases are permanently destroyed and pruned from the server.</div>
                                    </div>
                                </div>
                            </label>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                            <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                                Cancel
                            </button>
                            <button onClick={confirmDeleteStack} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all text-white ${deleteWipe ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/20' : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20'}`}>
                                {deleteWipe ? 'Wipe Everything' : 'Delete Stack'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthGuard>
    );
}
