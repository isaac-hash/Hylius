"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { useAuth } from "@/providers/auth.provider";
import io from "socket.io-client";
import AddProjectModal from "@/components/AddProjectModal";

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

    // GitHub Actions setup panel
    const [ghSetupProjectId, setGhSetupProjectId] = useState<string | null>(null);
    const [apiTokenValue, setApiTokenValue] = useState<string | null>(null);
    const [apiTokenLoading, setApiTokenLoading] = useState(false);

    // Provisioned PR banners (set from CreateStackModal via localStorage)
    const [provisionedPrs, setProvisionedPrs] = useState<Record<string, { name: string; prUrl: string; token: string; webhookUrl: string }>>({});

    // Add Resource state
    const [showAddProject, setShowAddProject] = useState(false);
    const [showAddDatabase, setShowAddDatabase] = useState(false);
    const [dbProvisionName, setDbProvisionName] = useState('');
    const [dbProvisionEngine, setDbProvisionEngine] = useState<'POSTGRES' | 'MYSQL' | 'REDIS'>('POSTGRES');
    const [dbProvisioning, setDbProvisioning] = useState(false);
    const [dbProvisionLinkTo, setDbProvisionLinkTo] = useState<string | null>(null);

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

    // Read provisioned PRs from localStorage (set by CreateStackModal after creation)
    useEffect(() => {
        if (!id) return;
        const key = `hylius_stack_prs_${id}`;
        const stored = localStorage.getItem(key);
        if (stored) {
            try {
                setProvisionedPrs(JSON.parse(stored));
            } catch { /* ignore */ }
            localStorage.removeItem(key); // one-time display
        }
    }, [id]);

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

    async function openGhSetup(projectId: string) {
        setGhSetupProjectId(projectId);
        if (apiTokenValue) return; // already loaded
        setApiTokenLoading(true);
        try {
            // Try to reuse an existing token, or create one
            const listRes = await fetch('/api/tokens', { headers: { Authorization: `Bearer ${token}` } });
            const listData = await listRes.json();
            const existing = (listData || []).find((t: any) => t.name?.startsWith('GitHub Actions'));
            if (existing?.plainToken) {
                setApiTokenValue(existing.plainToken);
            } else if (existing) {
                // We have a token but plain value not stored — prompt user to create new
                setApiTokenValue('(create a new token on the API Tokens page to reveal)');
            } else {
                // Create one automatically
                const createRes = await fetch('/api/tokens', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ name: 'GitHub Actions - Auto' }),
                });
                const createData = await createRes.json();
                setApiTokenValue(createData.plainToken || '(check API Tokens page)');
            }
        } catch {
            setApiTokenValue('(failed to load — check API Tokens page)');
        } finally {
            setApiTokenLoading(false);
        }
    }

    async function handleRemoveDatabase(databaseId: string) {
        if (!confirm('Remove this database from the stack? (This does not delete the database)')) return;
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

    // --- Independent Actions ---
    async function handleDeployService(projectId: string) {
        try {
            const res = await fetch(`/api/projects/${projectId}/deploy`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to start deployment');
            alert('Deployment started! View logs from the Server or Project page.');
            fetchStack();
        } catch (err: any) {
            alert(err.message || 'Deployment error');
        }
    }

    async function handleDeleteService(projectId: string, projectName: string) {
        if (!confirm(`WARNING: Completely wipe service "${projectName}"? This will stop and remove its container, and delete all deployment files permanently.`)) return;
        try {
            const res = await fetch(`/api/projects/${projectId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to wipe service');
            fetchStack();
        } catch (err: any) {
            alert(err.message || 'Failed to wipe service');
        }
    }

    async function handleDeleteDatabase(databaseId: string, databaseName: string) {
        if (!confirm(`WARNING: Completely wipe database "${databaseName}"? This will stop and remove its container, and DELETE THE PERSISTENT DATA VOLUME. All data will be lost forever.`)) return;
        try {
            const res = await fetch(`/api/databases/${databaseId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ removeVolume: true }),
            });
            if (!res.ok) throw new Error('Failed to wipe database');
            fetchStack();
        } catch (err: any) {
            alert(err.message || 'Failed to wipe database');
        }
    }

    async function handleProvisionDatabase() {
        if (!dbProvisionName.trim() || !stack) return;
        setDbProvisioning(true);
        try {
            const version = { POSTGRES: '16', MYSQL: '8', REDIS: '7' }[dbProvisionEngine];
            const res = await fetch(`/api/stacks/${stack.id}/databases/provision`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ 
                    name: dbProvisionName.trim(), 
                    engine: dbProvisionEngine, 
                    version,
                    linkToProjectIds: dbProvisionLinkTo ? [dbProvisionLinkTo] : []
                })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Provisioning failed');
            }
            setShowAddDatabase(false);
            setDbProvisionName('');
            fetchStack();
        } catch (err: any) {
            alert(err.message || 'Failed to provision database');
        } finally {
            setDbProvisioning(false);
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
                                <div className="relative group">
                                    <button className="bg-violet-600/20 text-violet-400 hover:bg-violet-600/30 border border-violet-500/30 px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Add Resource
                                    </button>
                                    <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-800 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                                        <button
                                            onClick={() => setShowAddProject(true)}
                                            className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2"
                                        >
                                            <span className="text-blue-400">📦</span> Add Service
                                        </button>
                                        <button
                                            onClick={() => setShowAddDatabase(true)}
                                            className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 hover:text-white flex items-center gap-2"
                                        >
                                            <span className="text-violet-400">🗄️</span> Add Database
                                        </button>
                                    </div>
                                </div>
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

                                            {/* Provisioned PR Banner */}
                                            {provisionedPrs[project.id] && (
                                                <div className="mb-2 bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-xl">
                                                    <div className="flex items-start gap-3 mb-3">
                                                        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                                        <div>
                                                            <h3 className="font-medium text-green-300 text-sm">Project Created &amp; Workflow Provisioned!</h3>
                                                            <p className="text-xs mt-1 text-green-100/70">Add these two secrets to your GitHub repo so the workflow can notify Hylius when a build completes:</p>
                                                        </div>
                                                        <button onClick={() => setProvisionedPrs(prev => { const n = {...prev}; delete n[project.id]; return n; })} className="ml-auto text-green-400 hover:text-green-300">
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                        </button>
                                                    </div>
                                                    <div className="space-y-3 pl-8">
                                                        <div>
                                                            <label className="block text-xs text-green-400/80 font-mono mb-1">HYLIUS_WEBHOOK_URL</label>
                                                            <div className="flex bg-black/50 border border-green-500/30 rounded overflow-hidden">
                                                                <input readOnly value={provisionedPrs[project.id].webhookUrl || ''} className="flex-1 bg-transparent p-2 text-sm text-green-100 font-mono outline-none" />
                                                                <button onClick={() => navigator.clipboard.writeText(provisionedPrs[project.id].webhookUrl || '')} className="px-3 bg-green-500/20 hover:bg-green-500/30 text-green-300 transition-colors" title="Copy">📋</button>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs text-green-400/80 font-mono mb-1">HYLIUS_API_TOKEN</label>
                                                            <div className="flex bg-black/50 border border-green-500/30 rounded overflow-hidden">
                                                                <input readOnly value={provisionedPrs[project.id].token || ''} className="flex-1 bg-transparent p-2 text-sm text-green-100 font-mono outline-none" />
                                                                <button onClick={() => navigator.clipboard.writeText(provisionedPrs[project.id].token || '')} className="px-3 bg-green-500/20 hover:bg-green-500/30 text-green-300 transition-colors" title="Copy">📋</button>
                                                            </div>
                                                        </div>
                                                        {provisionedPrs[project.id].prUrl && (
                                                            <div className="p-3 bg-violet-500/10 border border-violet-500/30 rounded-lg">
                                                                <p className="text-xs text-violet-300 mb-2">⚡ <strong>One more step:</strong> Merge the Dagger CI pipeline PR to activate auto-deploys.</p>
                                                                <a
                                                                    href={provisionedPrs[project.id].prUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                                    View &amp; Merge PR on GitHub
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
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
                                                        {(project.deployStrategy === 'dagger' || project.deployStrategy === 'ghcr-pull') && (
                                                            <button
                                                                onClick={() => openGhSetup(project.id)}
                                                                title="GitHub Actions setup"
                                                                className="text-xs text-yellow-500 hover:text-yellow-400 px-2 py-1.5 rounded-lg hover:bg-yellow-500/10 transition-colors flex items-center gap-1"
                                                            >
                                                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.11.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" /></svg>
                                                                CI/CD Setup
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDeployService(project.id)}
                                                            className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1.5 rounded-lg hover:bg-blue-500/10 transition-colors flex items-center gap-1"
                                                            title="Deploy this service independently"
                                                        >
                                                            🚀 Deploy
                                                        </button>
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
                                                            title="Unlink from stack (does not delete)"
                                                        >
                                                            Unlink
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteService(project.id, project.name)}
                                                            className="text-xs text-red-500 hover:text-red-400 px-2 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                                                            title="Completely wipe service and delete data"
                                                        >
                                                            🗑️ Wipe & Delete
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
                                                    className="text-xs text-gray-600 hover:text-red-400 px-2 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                                                    title="Unlink from stack (does not delete)"
                                                >
                                                    Unlink
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteDatabase(db.id, db.name)}
                                                    className="text-xs text-red-500 hover:text-red-400 px-2 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                                                    title="Completely wipe database and delete data"
                                                >
                                                    🗑️ Wipe & Delete
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

            {/* GitHub Actions Setup Modal */}
            {ghSetupProjectId && stack && (() => {
                const project = stack.projects.find(p => p.id === ghSetupProjectId);
                if (!project) return null;
                const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/deploy-complete` : '/api/webhooks/deploy-complete';
                const repoName = project.repoUrl?.replace(/.*github\.com\//, '').replace(/\.git$/, '') || 'your-org/your-repo';
                const imageName = `ghcr.io/${repoName.toLowerCase()}:latest`;
                const workflowYaml = `name: Deploy to Hylius

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Build and push image
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: ${imageName}

      - name: Notify Hylius
        run: |
          curl -X POST ${webhookUrl} \\
            -H "Authorization: Bearer \${{ secrets.HYLIUS_API_TOKEN }}" \\
            -H "Content-Type: application/json" \\
            -d '{
              "repo": "${repoName}",
              "image": "${imageName}",
              "sha": "'\${{ github.sha }}'",
              "ref": "'\${{ github.ref }}'"
            }'`;

                return (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setGhSetupProjectId(null)}>
                        <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between p-6 border-b border-gray-800">
                                <div>
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.11.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" /></svg>
                                        GitHub Actions Setup — {project.name}
                                    </h2>
                                    <p className="text-xs text-gray-500 mt-1">Add these secrets to your GitHub repo and copy the workflow below.</p>
                                </div>
                                <button onClick={() => setGhSetupProjectId(null)} className="text-gray-500 hover:text-white transition-colors text-xl">✕</button>
                            </div>

                            <div className="p-6 space-y-5">
                                {/* Secrets */}
                                <div>
                                    <h3 className="text-sm font-semibold text-white mb-3">1. Add GitHub Repository Secrets</h3>
                                    <div className="space-y-2">
                                        <div className="bg-black border border-gray-800 rounded-xl p-3">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-mono text-yellow-400">HYLIUS_API_TOKEN</span>
                                                <button
                                                    onClick={() => { if (apiTokenValue) { navigator.clipboard.writeText(apiTokenValue); } }}
                                                    className="text-xs text-gray-500 hover:text-white transition-colors"
                                                >
                                                    Copy
                                                </button>
                                            </div>
                                            {apiTokenLoading ? (
                                                <div className="text-xs text-gray-500">Loading token...</div>
                                            ) : (
                                                <div className="text-xs font-mono text-gray-300 break-all">{apiTokenValue || '—'}</div>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-600">Go to your GitHub repo → Settings → Secrets and variables → Actions → New repository secret.</p>
                                    </div>
                                </div>

                                {/* Webhook URL */}
                                <div>
                                    <h3 className="text-sm font-semibold text-white mb-3">2. Webhook URL (for reference)</h3>
                                    <div className="bg-black border border-gray-800 rounded-xl p-3 flex items-center justify-between">
                                        <span className="text-xs font-mono text-blue-400 truncate">{webhookUrl}</span>
                                        <button onClick={() => navigator.clipboard.writeText(webhookUrl)} className="text-xs text-gray-500 hover:text-white ml-3 shrink-0 transition-colors">Copy</button>
                                    </div>
                                </div>

                                {/* Workflow YAML */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-semibold text-white">3. Add Workflow File</h3>
                                        <button
                                            onClick={() => navigator.clipboard.writeText(workflowYaml)}
                                            className="text-xs text-gray-500 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-800"
                                        >
                                            Copy YAML
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-600 mb-2">Save this as <code className="text-gray-400">.github/workflows/deploy.yml</code> in your repository.</p>
                                    <pre className="bg-black border border-gray-800 rounded-xl p-4 text-xs text-gray-300 font-mono overflow-auto max-h-80 whitespace-pre">{workflowYaml}</pre>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

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
            {/* Add Project Modal */}
            {stack && (
                <AddProjectModal
                    isOpen={showAddProject}
                    onClose={() => setShowAddProject(false)}
                    serverId={stack.server.id}
                    serverName={stack.server.name}
                    onAdded={async (projectId, successData) => {
                        if (projectId) {
                            try {
                                await fetch(`/api/stacks/${stack.id}/services`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                    body: JSON.stringify({ projectId }),
                                });
                                // Automatically save PR metadata so the banner shows up
                                if (successData && successData.prUrl) {
                                    setProvisionedPrs(prev => ({
                                        ...prev,
                                        [projectId]: {
                                            name: 'New Service',
                                            prUrl: successData.prUrl!,
                                            token: successData.token,
                                            webhookUrl: successData.webhookUrl
                                        }
                                    }));
                                }
                                fetchStack();
                            } catch {
                                alert('Project created but failed to link to stack.');
                            }
                        }
                    }}
                />
            )}

            {/* Add Database Modal */}
            {showAddDatabase && stack && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget && !dbProvisioning) setShowAddDatabase(false); }}>
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-gray-800">
                            <h2 className="text-lg font-bold flex items-center gap-2">🗄️ Add Database</h2>
                            {!dbProvisioning && (
                                <button onClick={() => setShowAddDatabase(false)} className="text-gray-400 hover:text-white">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Engine</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['POSTGRES', 'MYSQL', 'REDIS'] as const).map(eng => (
                                        <button
                                            key={eng}
                                            onClick={() => setDbProvisionEngine(eng)}
                                            disabled={dbProvisioning}
                                            className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                                                dbProvisionEngine === eng
                                                    ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                                                    : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                                            }`}
                                        >
                                            <span className="text-xl">{getEngineIcon(eng)}</span>
                                            <span className="text-xs font-medium">{eng}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Name</label>
                                <input
                                    type="text"
                                    value={dbProvisionName}
                                    onChange={e => setDbProvisionName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                                    disabled={dbProvisioning}
                                    placeholder="e.g. my-app-db"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 disabled:opacity-60"
                                />
                                <p className="text-[10px] text-gray-500 mt-1">
                                    Container: <code className="text-gray-400">hylius-db-{dbProvisionName || 'my-app-db'}</code>
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Link to Service (Optional)</label>
                                <select
                                    value={dbProvisionLinkTo || ''}
                                    onChange={e => setDbProvisionLinkTo(e.target.value || null)}
                                    disabled={dbProvisioning}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 disabled:opacity-60"
                                >
                                    <option value="">Don't link to a service</option>
                                    {stack.projects.map(p => (
                                        <option key={p.id} value={p.id}>Link to {p.name}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-gray-500 mt-1">
                                    Automatically injects connection strings into the selected service.
                                </p>
                            </div>

                            <div className="flex items-start gap-2 text-[10px] text-gray-500 bg-gray-800/50 rounded-lg p-3">
                                <span className="flex-shrink-0">🔒</span>
                                <span>
                                    Password is auto-generated. Database binds to <code>127.0.0.1</code> only.
                                    It will be available for you to link to services.
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 px-5 pb-5">
                            <button
                                onClick={() => setShowAddDatabase(false)}
                                disabled={dbProvisioning}
                                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800 text-sm transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleProvisionDatabase}
                                disabled={!dbProvisionName.trim() || dbProvisioning}
                                className="flex-1 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(124,58,237,0.3)]"
                            >
                                {dbProvisioning ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Provisioning...
                                    </>
                                ) : (
                                    <>🚀 Provision Database</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthGuard>
    );
}
