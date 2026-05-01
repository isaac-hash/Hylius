'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth.provider';
import { STACK_TEMPLATES } from './StackTemplates';
import toast from 'react-hot-toast';

interface Server {
    id: string;
    name: string;
    ip: string;
}

interface Project {
    id: string;
    name: string;
    deployStrategy: string | null;
    serverId: string;
    stackId?: string | null;
    role?: string | null;
}

interface Database {
    id: string;
    name: string;
    engine: string;
    status: string;
    serverId: string;
    stackId?: string | null;
}

interface GitHubRepo {
    id: number;
    fullName: string;
    name: string;
    private: boolean;
    defaultBranch: string;
    cloneUrl: string;
    htmlUrl: string;
    description: string | null;
    language: string | null;
    updatedAt: string;
}

interface CreateStackModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated?: (stackId: string) => void;
}

const STEPS = ['template', 'info', 'services', 'database', 'connections', 'review'] as const;
type Step = typeof STEPS[number];

const STEP_LABELS: Record<Step, string> = {
    template: 'Start from Template',
    info: 'Stack Details',
    services: 'Services',
    database: 'Databases',
    connections: 'Connections',
    review: 'Review & Launch',
};

// Queued new items
interface NewService {
    tempId: string;
    name: string;
    role: 'frontend' | 'backend' | 'worker' | 'database-client' | 'other';
    repoUrl: string;
    branch: string;
    deployPath: string;
    buildCommand?: string;
    startCommand?: string;
    deployStrategy: 'dagger' | 'auto' | 'compose-server' | 'ghcr-pull' | 'compose-registry';
    githubRepoFullName?: string;
    githubInstallationId?: number;
    containerName: string;
    envVars: Record<string, string>;
}

interface NewDatabase {
    tempId: string;
    name: string;
    engine: 'POSTGRES' | 'MYSQL' | 'REDIS';
    version?: string;
    containerName: string;
}

interface WiringSuggestion {
    fromTempId: string;
    toTempId: string; // can be 'db:...'
    envKey: string;
    envValue: string;
    isPlaceholder?: boolean;
}

function generateTempId() {
    return Math.random().toString(36).substr(2, 9);
}

function getStrategyIcon(strategy: string | null) {
    switch (strategy) {
        case 'dagger': return '⚡';
        case 'docker-compose': case 'compose-server': case 'compose-registry': return '🐳';
        case 'ghcr-pull': return '📦';
        case 'railpack': case 'nixpacks': return '🏗️';
        default: return '📄';
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

export default function CreateStackModal({ isOpen, onClose, onCreated }: CreateStackModalProps) {
    const { token } = useAuth();
    const router = useRouter();
    const [step, setStep] = useState<Step>('template');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Creation Progress State
    const [isCreating, setIsCreating] = useState(false);
    const [creationProgress, setCreationProgress] = useState<{ step: string; status: 'pending' | 'active' | 'done' | 'error'; message?: string }[]>([]);

    // Step 1: Info
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [serverId, setServerId] = useState('');

    // Data Lookups
    const [servers, setServers] = useState<Server[]>([]);
    const [existingProjects, setExistingProjects] = useState<Project[]>([]);
    const [existingDatabases, setExistingDatabases] = useState<Database[]>([]);

    // GitHub lookup
    const [repos, setRepos] = useState<GitHubRepo[]>([]);
    const [githubConnected, setGithubConnected] = useState(false);
    const [installationId, setInstallationId] = useState<number>(0);
    const [reposLoading, setReposLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Selected Existing Items
    const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
    const [selectedDatabases, setSelectedDatabases] = useState<string[]>([]);

    // Queued New Items
    const [newServices, setNewServices] = useState<NewService[]>([]);
    const [newDatabases, setNewDatabases] = useState<NewDatabase[]>([]);

    // Wiring Suggestions
    const [suggestions, setSuggestions] = useState<WiringSuggestion[]>([]);
    const [appliedSuggestions, setAppliedSuggestions] = useState<boolean>(false);

    // Service Forms
    const [serviceTab, setServiceTab] = useState<'existing' | 'new'>('existing');
    const [dbTab, setDbTab] = useState<'existing' | 'new'>('existing');
    const [repoMode, setRepoMode] = useState<'manual' | 'github'>('manual');

    const [newServiceForm, setNewServiceForm] = useState<Partial<NewService>>({
        role: 'frontend',
        deployStrategy: 'dagger',
        branch: 'main',
    });

    const [newDbForm, setNewDbForm] = useState<Partial<NewDatabase>>({
        engine: 'POSTGRES',
        version: '16'
    });

    // Public Entry Point
    const [publicEntryPoint, setPublicEntryPoint] = useState<string | null>(null);

    // Initial Fetch
    useEffect(() => {
        if (isOpen) {
            fetchServers();
            fetchRepos(); // Prefetch repos
        } else {
            resetForm();
        }
    }, [isOpen]);

    useEffect(() => {
        if (serverId) {
            fetchServerResources();
        }
    }, [serverId]);

    // Compute suggestions when entering connections step
    useEffect(() => {
        if (step === 'connections') {
            computeSuggestions();
        }
    }, [step, newServices, newDatabases]);

    if (!isOpen) return null;

    async function fetchServers() {
        try {
            const res = await fetch('/api/servers', { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            setServers(data);
            if (data.length === 1) setServerId(data[0].id);
        } catch {
            setError('Failed to load servers');
        }
    }

    async function fetchServerResources() {
        try {
            const [projRes, dbRes] = await Promise.all([
                fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`/api/databases?serverId=${serverId}`, { headers: { Authorization: `Bearer ${token}` } }),
            ]);
            const projData = await projRes.json();
            const dbData = await dbRes.json();

            setExistingProjects((projData || []).filter((p: Project) => p.serverId === serverId && !p.stackId));
            setExistingDatabases((dbData || []).filter((d: Database) => d.serverId === serverId && !d.stackId));
        } catch {
            // Non-critical
        }
    }

    async function fetchRepos() {
        setReposLoading(true);
        try {
            const res = await fetch('/api/github/repos', { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (data.connected) {
                setGithubConnected(true);
                setRepos(data.repos || []);
                if (data.installation?.installationId) {
                    setInstallationId(Number(data.installation.installationId));
                }
            } else {
                setGithubConnected(false);
            }
        } catch {
            console.error('Failed to fetch GitHub repos');
        } finally {
            setReposLoading(false);
        }
    }

    // Handlers
    function selectRepoForService(repo: GitHubRepo) {
        setNewServiceForm(f => ({
            ...f,
            repoUrl: repo.cloneUrl,
            githubRepoFullName: repo.fullName,
            githubInstallationId: installationId
        }));
        if (!newServiceForm.name) {
            setNewServiceForm(f => ({ ...f, name: repo.name }));
        }
        setRepoMode('manual');
    }

    function applyTemplate(templateId: string) {
        if (templateId === 'blank') {
            setStep('info');
            return;
        }

        const template = STACK_TEMPLATES.find(t => t.id === templateId);
        if (!template) return;

        // Auto-generate some names based on template
        const slug = name ? name.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'my-app';

        const services = template.services.map(s => ({
            tempId: generateTempId(),
            name: `${slug}-${s.name}`,
            role: s.role as any,
            repoUrl: '', // To be filled by user later
            branch: s.branch,
            deployPath: `/var/www/${slug}-${s.name}`,
            deployStrategy: s.deployStrategy as any,
            containerName: `${slug}-${s.name}`,
            envVars: {}
        }));

        const dbs = template.databases.map(d => ({
            tempId: generateTempId(),
            name: `${slug}-${d.name}`,
            engine: d.engine as any,
            version: d.version,
            containerName: `${slug}-${d.name}`
        }));

        setNewServices(services);
        setNewDatabases(dbs);
        setServiceTab('new');
        setDbTab('new');

        if (services.length > 0) {
            setPublicEntryPoint(services[0].tempId);
        }

        setStep('info');
    }

    function addQueuedService(e: React.FormEvent) {
        e.preventDefault();
        if (!newServiceForm.name || !newServiceForm.repoUrl) {
            toast.error('Name and repo URL are required');
            return;
        }

        const stackSlug = name ? name.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'stack';
        const serviceSlug = newServiceForm.name.toLowerCase().replace(/[^a-z0-9]/g, '-');

        const service: NewService = {
            tempId: generateTempId(),
            name: newServiceForm.name,
            role: newServiceForm.role as any,
            repoUrl: newServiceForm.repoUrl,
            branch: newServiceForm.branch || 'main',
            deployPath: newServiceForm.deployPath || `/var/www/${serviceSlug}`,
            buildCommand: newServiceForm.buildCommand,
            startCommand: newServiceForm.startCommand,
            deployStrategy: newServiceForm.deployStrategy as any,
            githubRepoFullName: newServiceForm.githubRepoFullName,
            githubInstallationId: newServiceForm.githubInstallationId,
            containerName: `${stackSlug}-${serviceSlug}`,
            envVars: {}
        };

        setNewServices(prev => [...prev, service]);
        if (!publicEntryPoint) setPublicEntryPoint(service.tempId);

        // Reset form
        setNewServiceForm({
            role: 'frontend',
            deployStrategy: 'dagger',
            branch: 'main',
        });
        setRepoMode('manual');
    }

    function removeQueuedService(tempId: string) {
        setNewServices(prev => prev.filter(s => s.tempId !== tempId));
        if (publicEntryPoint === tempId) {
            setPublicEntryPoint(null);
        }
    }

    function addQueuedDatabase(e: React.FormEvent) {
        e.preventDefault();
        if (!newDbForm.name || !newDbForm.engine) {
            toast.error('Name and engine are required');
            return;
        }

        const stackSlug = name ? name.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'stack';
        const dbSlug = newDbForm.name.toLowerCase().replace(/[^a-z0-9]/g, '-');

        const db: NewDatabase = {
            tempId: generateTempId(),
            name: newDbForm.name,
            engine: newDbForm.engine as any,
            version: newDbForm.version,
            containerName: `${stackSlug}-${dbSlug}`
        };

        setNewDatabases(prev => [...prev, db]);
        setNewDbForm({ engine: 'POSTGRES', version: '16' });
    }

    function removeQueuedDatabase(tempId: string) {
        setNewDatabases(prev => prev.filter(d => d.tempId !== tempId));
    }

    function computeSuggestions() {
        const suggs: WiringSuggestion[] = [];

        // Get the selected server's IP for building public sslip.io URLs
        const selectedServer = servers.find(s => s.id === serverId);
        const serverIpSlug = selectedServer ? selectedServer.ip.replace(/\./g, '-') : 'your-server-ip';

        const frontends = newServices.filter(s => s.role === 'frontend');
        const backends = newServices.filter(s => s.role === 'backend');

        // Frontend -> Backend
        for (const fe of frontends) {
            for (const be of backends) {
                // Server-side var: use internal Docker network hostname (fast, no DNS)
                suggs.push({
                    fromTempId: fe.tempId,
                    toTempId: be.tempId,
                    envKey: 'API_URL',
                    envValue: `http://${be.containerName}:8000`
                });
                // Public/browser var: use predictable sslip.io public domain
                // (browsers can't resolve internal Docker hostnames)
                const publicBackendUrl = `https://${be.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-${serverIpSlug}.sslip.io`;
                suggs.push({
                    fromTempId: fe.tempId,
                    toTempId: be.tempId,
                    envKey: 'NEXT_PUBLIC_API_URL',
                    envValue: publicBackendUrl
                });
                suggs.push({
                    fromTempId: fe.tempId,
                    toTempId: be.tempId,
                    envKey: 'VITE_API_URL',
                    envValue: publicBackendUrl
                });
                suggs.push({
                    fromTempId: fe.tempId,
                    toTempId: be.tempId,
                    envKey: 'REACT_APP_API_URL',
                    envValue: publicBackendUrl
                });
            }
        }

        // Backend -> DB
        for (const be of backends) {
            for (const db of newDatabases) {
                const port = db.engine === 'POSTGRES' ? 5432 : db.engine === 'MYSQL' ? 3306 : 6379;
                const protocol = db.engine === 'POSTGRES' ? 'postgres' : db.engine === 'MYSQL' ? 'mysql' : 'redis';
                const envKey = db.engine === 'REDIS' ? 'REDIS_URL' : 'DATABASE_URL';

                suggs.push({
                    fromTempId: be.tempId,
                    toTempId: `db:${db.tempId}`,
                    envKey,
                    envValue: `${protocol}://user:pass@${db.containerName}:${port}/app`,
                    isPlaceholder: true
                });
            }
        }

        setSuggestions(suggs);
        setAppliedSuggestions(false);
    }

    function applySuggestions() {
        setNewServices(prev => prev.map(service => {
            const serviceSuggs = suggestions.filter(s => s.fromTempId === service.tempId);
            if (serviceSuggs.length === 0) return service;

            const newEnvVars = { ...service.envVars };
            serviceSuggs.forEach(sugg => {
                newEnvVars[sugg.envKey] = sugg.envValue;
            });

            return { ...service, envVars: newEnvVars };
        }));
        setAppliedSuggestions(true);
        toast.success('Wiring suggestions applied!');
    }

    async function handleCreate() {
        setError('');
        setIsCreating(true);

        // Initialize progress
        type ProgressStep = { step: string; status: 'pending' | 'active' | 'done' | 'error'; message?: string };
        const prog: ProgressStep[] = [
            { step: 'stack', status: 'active', message: 'Creating stack record...' }
        ];
        if (newDatabases.length > 0) prog.push({ step: 'db', status: 'pending', message: `Provisioning ${newDatabases.length} database(s)... (this takes ~1 min)` });
        if (newServices.length > 0) prog.push({ step: 'services', status: 'pending', message: `Registering ${newServices.length} service(s)...` });
        prog.push({ step: 'link', status: 'pending', message: 'Finalising connections...' });
        setCreationProgress(prog);

        const updateProg = (stepKey: string, status: 'active' | 'done' | 'error') => {
            setCreationProgress(prev => prev.map(p => p.step === stepKey ? { ...p, status } : p));
        };

        try {
            // 1. Create the stack
            const stackRes = await fetch('/api/stacks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ name, description: description || undefined, serverId }),
            });

            if (!stackRes.ok) throw new Error((await stackRes.json()).error || 'Failed to create stack');
            const stack = await stackRes.json();
            updateProg('stack', 'done');

            // Link existing items first (fast)
            for (const projectId of selectedProjects) {
                await fetch(`/api/stacks/${stack.id}/services`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ projectId }),
                });
            }
            for (const databaseId of selectedDatabases) {
                await fetch(`/api/stacks/${stack.id}/databases`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ databaseId }),
                });
            }

            // Map to store created DB IDs for linking
            const dbMap: Record<string, string> = {};
            const projectMap: Record<string, string> = {};

            // 2. Provision New Databases (slow)
            if (newDatabases.length > 0) {
                updateProg('db', 'active');
                for (const db of newDatabases) {
                    const dbRes = await fetch(`/api/stacks/${stack.id}/databases/provision`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({
                            name: db.name,
                            engine: db.engine,
                            version: db.version
                        }),
                    });
                    if (!dbRes.ok) throw new Error((await dbRes.json()).error || `Failed to provision DB ${db.name}`);
                    const dbData = await dbRes.json();
                    dbMap[db.tempId] = dbData.databaseId;
                }
                updateProg('db', 'done');
            }

            // 3. Create New Services
            const provisionedPrUrls: Record<string, { name: string; prUrl: string; token: string; webhookUrl: string }> = {};
            if (newServices.length > 0) {
                updateProg('services', 'active');
                for (const service of newServices) {
                    const svcRes = await fetch('/api/projects', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({
                            name: service.name,
                            repoUrl: service.repoUrl,
                            branch: service.branch,
                            deployPath: service.deployPath,
                            buildCommand: service.buildCommand,
                            startCommand: service.startCommand,
                            deployStrategy: service.deployStrategy,
                            githubRepoFullName: service.githubRepoFullName,
                            githubInstallationId: service.githubInstallationId,
                            role: service.role,
                            containerName: service.containerName,
                            serverId
                        }),
                    });
                    if (!svcRes.ok) throw new Error((await svcRes.json()).error || `Failed to create service ${service.name}`);
                    const svcData = await svcRes.json();
                    projectMap[service.tempId] = svcData.id;

                    // Capture PR URL + credentials if a Dagger/GHCR workflow was provisioned
                    if (svcData.prUrl || service.deployStrategy === 'dagger' || service.deployStrategy === 'ghcr-pull') {
                        // Create a per-service API token for GitHub Actions
                        let deployToken = '';
                        try {
                            const tokenRes = await fetch('/api/tokens', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ name: `GitHub Actions - ${service.name}` }),
                            });
                            if (tokenRes.ok) {
                                const tokenData = await tokenRes.json();
                                deployToken = tokenData.token || tokenData.plainToken || '';
                            }
                        } catch { /* non-fatal */ }

                        provisionedPrUrls[svcData.id] = {
                            name: service.name,
                            prUrl: svcData.prUrl ?? '',
                            token: deployToken,
                            webhookUrl: `${window.location.origin}/api/webhooks/deploy-complete`,
                        };
                    }

                    // Link to stack
                    await fetch(`/api/stacks/${stack.id}/services`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ projectId: svcData.id }),
                    });

                    // Save Env Vars
                    if (Object.keys(service.envVars).length > 0) {
                        // Strip placeholder DB URLs as real ones will be injected if linked
                        const varsToSave = { ...service.envVars };
                        Object.keys(varsToSave).forEach(k => {
                            if (varsToSave[k].includes('user:pass@')) delete varsToSave[k];
                        });

                        await fetch(`/api/projects/${svcData.id}/env`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify(varsToSave),
                        });
                    }
                }
                updateProg('services', 'done');
            }

            // 4. Link new DBs to new Projects based on suggestions
            updateProg('link', 'active');
            for (const sugg of suggestions) {
                if (sugg.toTempId.startsWith('db:')) {
                    const dbTempId = sugg.toTempId.replace('db:', '');
                    const dbId = dbMap[dbTempId];
                    const projectId = projectMap[sugg.fromTempId];
                    if (dbId && projectId) {
                        await fetch(`/api/databases/${dbId}/link`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify({ projectId }),
                        });
                    }
                }
            }
            updateProg('link', 'done');

            setTimeout(() => {
                // Store provisioned PR data so the stack detail page can show the banner
                if (Object.keys(provisionedPrUrls ?? {}).length > 0) {
                    localStorage.setItem(`hylius_stack_prs_${stack.id}`, JSON.stringify(provisionedPrUrls));
                }
                onCreated?.(stack.id);
                onClose();
                resetForm();
                router.push(`/stacks/${stack.id}`);
            }, 1000);

        } catch (err: unknown) {
            updateProg('stack', 'error');
            updateProg('db', 'error');
            updateProg('services', 'error');
            updateProg('link', 'error');
            setError(err instanceof Error ? err.message : 'Something went wrong');
            setIsCreating(false);
        }
    }

    function resetForm() {
        setStep('template');
        setName('');
        setDescription('');
        setServerId(servers.length === 1 ? servers[0].id : '');
        setSelectedProjects([]);
        setSelectedDatabases([]);
        setNewServices([]);
        setNewDatabases([]);
        setSuggestions([]);
        setAppliedSuggestions(false);
        setError('');
        setIsCreating(false);
        setPublicEntryPoint(null);
    }

    function goNext() {
        const idx = STEPS.indexOf(step);
        if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
    }

    function goBack() {
        const idx = STEPS.indexOf(step);
        if (idx > 0) setStep(STEPS[idx - 1]);
    }

    const canProceed = () => {
        if (step === 'info') return name.trim().length > 0 && serverId.length > 0;
        if (step === 'services') return selectedProjects.length > 0 || newServices.length > 0;
        return true;
    };

    const stepIndex = STEPS.indexOf(step);
    const selectedServer = servers.find(s => s.id === serverId);
    const filteredRepos = repos.filter(r => r.fullName.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-6 pb-4 border-b border-gray-800/50">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-white">{isCreating ? 'Creating Stack...' : 'Create Stack'}</h2>
                            <p className="text-sm text-gray-500 mt-0.5">{isCreating ? 'Please do not close this window' : STEP_LABELS[step]}</p>
                        </div>
                        {!isCreating && (
                            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">✕</button>
                        )}
                    </div>

                    {/* Step Indicator */}
                    {!isCreating && (
                        <div className="flex gap-1.5">
                            {STEPS.map((s, i) => (
                                <div
                                    key={s}
                                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= stepIndex ? 'bg-blue-500' : 'bg-gray-800'
                                        }`}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {error && !isCreating && (
                        <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm p-3 rounded-lg mb-4">
                            {error}
                        </div>
                    )}

                    {isCreating ? (
                        <div className="space-y-4 py-8 px-4">
                            {creationProgress.map((prog, i) => (
                                <div key={i} className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                                        {prog.status === 'done' && <div className="w-6 h-6 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center text-sm">✓</div>}
                                        {prog.status === 'active' && <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />}
                                        {prog.status === 'pending' && <div className="w-2 h-2 rounded-full bg-gray-700" />}
                                        {prog.status === 'error' && <div className="w-6 h-6 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center text-sm">✕</div>}
                                    </div>
                                    <p className={`text-sm ${prog.status === 'active' ? 'text-white font-medium' : prog.status === 'done' ? 'text-gray-400' : 'text-gray-500'}`}>
                                        {prog.message}
                                    </p>
                                </div>
                            ))}
                            {error && (
                                <div className="mt-8 bg-red-900/30 border border-red-800 text-red-400 text-sm p-4 rounded-lg">
                                    <strong>Creation Failed:</strong> {error}
                                </div>
                            )}
                        </div>
                    ) : step === 'template' ? (
                        <div className="grid grid-cols-2 gap-4">
                            {STACK_TEMPLATES.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => applyTemplate(t.id)}
                                    className="p-4 rounded-xl border border-gray-800 hover:border-blue-500 hover:bg-blue-500/5 transition-all text-left flex flex-col gap-2 group"
                                >
                                    <div className="text-3xl">{t.icon}</div>
                                    <h3 className="text-white font-medium group-hover:text-blue-400 transition-colors">{t.label}</h3>
                                    {t.services.length > 0 && (
                                        <p className="text-xs text-gray-500">
                                            {t.services.length} service(s), {t.databases.length} db(s)
                                        </p>
                                    )}
                                </button>
                            ))}
                        </div>
                    ) : step === 'info' ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1.5 font-medium">Stack Name <span className="text-red-400">*</span></label>
                                <input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="My SaaS App"
                                    className="w-full bg-black border border-gray-800 rounded-lg p-3 text-white text-sm placeholder-gray-600 focus:border-blue-600 focus:outline-none transition-colors"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1.5 font-medium">Description</label>
                                <input
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Frontend + API + Database (optional)"
                                    className="w-full bg-black border border-gray-800 rounded-lg p-3 text-white text-sm placeholder-gray-600 focus:border-blue-600 focus:outline-none transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1.5 font-medium">Deploy Server <span className="text-red-400">*</span></label>
                                <select
                                    value={serverId}
                                    onChange={e => setServerId(e.target.value)}
                                    className="w-full bg-black border border-gray-800 rounded-lg p-3 text-white text-sm focus:border-blue-600 focus:outline-none transition-colors"
                                >
                                    <option value="">Select a server...</option>
                                    {servers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.ip})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    ) : step === 'services' ? (
                        <div className="space-y-4">
                            <div className="flex gap-1 bg-black/50 p-1 rounded-lg border border-gray-800 mb-4">
                                <button onClick={() => setServiceTab('existing')} className={`flex-1 py-2 text-sm rounded-md transition-colors ${serviceTab === 'existing' ? 'bg-gray-800 text-white' : 'text-gray-500'}`}>Attach Existing</button>
                                <button onClick={() => setServiceTab('new')} className={`flex-1 py-2 text-sm rounded-md transition-colors ${serviceTab === 'new' ? 'bg-gray-800 text-white' : 'text-gray-500'}`}>+ Create New</button>
                            </div>

                            {serviceTab === 'existing' && (
                                <div className="space-y-2">
                                    {existingProjects.length === 0 ? (
                                        <p className="text-sm text-gray-500 text-center py-4">No available projects on this server.</p>
                                    ) : (
                                        existingProjects.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => setSelectedProjects(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                                                className={`w-full text-left p-3 rounded-xl border flex items-center gap-3 transition-colors ${selectedProjects.includes(p.id) ? 'border-blue-500 bg-blue-500/10' : 'border-gray-800'}`}
                                            >
                                                <span>{getStrategyIcon(p.deployStrategy)}</span>
                                                <div className="flex-1">
                                                    <div className="text-sm text-white">{p.name}</div>
                                                    <div className="text-xs text-gray-500">{p.deployStrategy || 'auto'}</div>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}

                            {serviceTab === 'new' && (
                                <div className="space-y-4">
                                    {newServices.map(svc => (
                                        <div key={svc.tempId} className="bg-gray-800/30 border border-gray-700 p-3 rounded-xl flex items-center justify-between">
                                            <div>
                                                <div className="text-sm text-white font-medium flex items-center gap-2">
                                                    <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs uppercase">{svc.role}</span>
                                                    {svc.name}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">Container: {svc.containerName}</div>
                                            </div>
                                            <button onClick={() => removeQueuedService(svc.tempId)} className="text-red-400 hover:text-red-300 p-2">✕</button>
                                        </div>
                                    ))}

                                    <form onSubmit={addQueuedService} className="border border-gray-800 p-4 rounded-xl space-y-4 bg-black/30">
                                        <h4 className="text-sm font-medium text-white">Define New Service</h4>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Service Name</label>
                                                <input value={newServiceForm.name || ''} onChange={e => setNewServiceForm(f => ({ ...f, name: e.target.value }))} placeholder="api" className="w-full bg-black border border-gray-800 rounded p-2 text-white text-sm" required />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Role</label>
                                                <select value={newServiceForm.role || 'frontend'} onChange={e => setNewServiceForm(f => ({ ...f, role: e.target.value as any }))} className="w-full bg-black border border-gray-800 rounded p-2 text-white text-sm">
                                                    <option value="frontend">Frontend</option>
                                                    <option value="backend">Backend</option>
                                                    <option value="worker">Worker</option>
                                                    <option value="database-client">DB Client</option>
                                                    <option value="other">Other</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Deployment Strategy</label>
                                            <select
                                                value={newServiceForm.deployStrategy || 'dagger'}
                                                onChange={e => setNewServiceForm(f => ({ ...f, deployStrategy: e.target.value as any }))}
                                                className="w-full bg-black border border-gray-800 rounded p-2 text-white text-sm"
                                            >
                                                <option value="dagger">⚡ Dagger (GitHub Actions → GHCR)</option>
                                                <option value="ghcr-pull">📦 GHCR Pull (CI/CD pre-built image)</option>
                                                <option value="railpack">🏗️ Railpack (auto-build on server)</option>
                                                <option value="nixpacks">🏗️ Nixpacks (auto-build on server)</option>
                                                <option value="compose-server">🐳 Docker Compose (build on server)</option>
                                                <option value="compose-registry">🐳 Compose + Registry (pull &amp; run)</option>
                                            </select>
                                            {(newServiceForm.deployStrategy === 'dagger' || newServiceForm.deployStrategy === 'ghcr-pull') && (
                                                <p className="text-xs text-yellow-500/80 mt-1.5 flex items-center gap-1">
                                                    <span>⚠️</span> GitHub Actions workflow required. Setup instructions will appear on the stack page after creation.
                                                </p>
                                            )}
                                        </div>

                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="block text-xs text-gray-500">Repository</label>
                                                <div className="flex gap-1 bg-black/50 p-1 rounded-lg border border-gray-800">
                                                    <button type="button" onClick={() => setRepoMode('manual')} className={`px-2 py-1 text-xs rounded transition-colors ${repoMode === 'manual' ? 'bg-gray-800 text-white' : 'text-gray-500'}`}>Manual</button>
                                                    <button type="button" onClick={() => setRepoMode('github')} className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${repoMode === 'github' ? 'bg-gray-800 text-white' : 'text-gray-500'}`}>
                                                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.11.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" /></svg>
                                                        GitHub
                                                    </button>
                                                </div>
                                            </div>

                                            {repoMode === 'manual' ? (
                                                <input
                                                    value={newServiceForm.repoUrl || ''}
                                                    onChange={e => {
                                                        setNewServiceForm(f => ({ ...f, repoUrl: e.target.value }));
                                                        if (newServiceForm.githubRepoFullName && !e.target.value.includes(newServiceForm.githubRepoFullName)) {
                                                            setNewServiceForm(f => ({ ...f, githubRepoFullName: undefined, githubInstallationId: undefined }));
                                                        }
                                                    }}
                                                    placeholder="https://github.com/org/repo.git"
                                                    className="w-full bg-black border border-gray-800 rounded p-2 text-white text-sm"
                                                    required={repoMode === 'manual'}
                                                />
                                            ) : (
                                                <div className="bg-black border border-gray-800 rounded p-3">
                                                    {reposLoading ? (
                                                        <div className="text-gray-500 text-sm text-center py-4">Loading repos...</div>
                                                    ) : !githubConnected ? (
                                                        <div className="text-center py-4">
                                                            <p className="text-gray-400 text-sm mb-3">GitHub App not connected yet</p>
                                                            <a href={`https://github.com/apps/${process.env.NEXT_PUBLIC_GITHUB_APP_SLUG || 'hylius-platform'}/installations/new`} className="inline-block px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm transition-colors" target="_blank" rel="noopener noreferrer">Connect GitHub</a>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <input type="text" placeholder="Search repos..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded p-2 text-white text-sm mb-2" />
                                                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                                                {repos.filter(r => (r.fullName || '').toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                                                                    <div className="text-gray-500 text-sm text-center py-4">No repos found</div>
                                                                ) : (
                                                                    repos.filter(r => (r.fullName || '').toLowerCase().includes(searchQuery.toLowerCase())).map(repo => (
                                                                        <button key={repo.id} type="button" onClick={() => selectRepoForService(repo)} className="w-full text-left p-2 rounded hover:bg-gray-800 text-sm text-gray-300 transition-colors flex items-center gap-2">
                                                                            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                                                                            {repo.fullName || repo.name}
                                                                        </button>
                                                                    ))
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <button type="submit" className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors border border-gray-700">
                                            + Queue Service
                                        </button>
                                    </form>
                                </div>
                            )}
                        </div>
                    ) : step === 'database' ? (
                        <div className="space-y-4">
                            <div className="flex gap-1 bg-black/50 p-1 rounded-lg border border-gray-800 mb-4">
                                <button onClick={() => setDbTab('existing')} className={`flex-1 py-2 text-sm rounded-md transition-colors ${dbTab === 'existing' ? 'bg-gray-800 text-white' : 'text-gray-500'}`}>Attach Existing</button>
                                <button onClick={() => setDbTab('new')} className={`flex-1 py-2 text-sm rounded-md transition-colors ${dbTab === 'new' ? 'bg-gray-800 text-white' : 'text-gray-500'}`}>+ Provision New</button>
                            </div>

                            {dbTab === 'existing' && (
                                <div className="space-y-2">
                                    {existingDatabases.length === 0 ? (
                                        <p className="text-sm text-gray-500 text-center py-4">No available databases on this server.</p>
                                    ) : (
                                        existingDatabases.map(d => (
                                            <button
                                                key={d.id}
                                                onClick={() => setSelectedDatabases(prev => prev.includes(d.id) ? prev.filter(x => x !== d.id) : [...prev, d.id])}
                                                className={`w-full text-left p-3 rounded-xl border flex items-center gap-3 transition-colors ${selectedDatabases.includes(d.id) ? 'border-green-500 bg-green-500/10' : 'border-gray-800'}`}
                                            >
                                                <span>{getEngineIcon(d.engine)}</span>
                                                <div className="flex-1">
                                                    <div className="text-sm text-white">{d.name}</div>
                                                    <div className="text-xs text-gray-500">{d.engine}</div>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}

                            {dbTab === 'new' && (
                                <div className="space-y-4">
                                    {newDatabases.map(db => (
                                        <div key={db.tempId} className="bg-gray-800/30 border border-gray-700 p-3 rounded-xl flex items-center justify-between">
                                            <div>
                                                <div className="text-sm text-white font-medium flex items-center gap-2">
                                                    <span>{getEngineIcon(db.engine)}</span>
                                                    {db.name}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">Engine: {db.engine}</div>
                                            </div>
                                            <button onClick={() => removeQueuedDatabase(db.tempId)} className="text-red-400 hover:text-red-300 p-2">✕</button>
                                        </div>
                                    ))}

                                    <form onSubmit={addQueuedDatabase} className="border border-gray-800 p-4 rounded-xl space-y-4 bg-black/30">
                                        <h4 className="text-sm font-medium text-white">Provision New Database</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Database Name</label>
                                                <input value={newDbForm.name || ''} onChange={e => setNewDbForm(f => ({ ...f, name: e.target.value }))} placeholder="db" className="w-full bg-black border border-gray-800 rounded p-2 text-white text-sm" required />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Engine</label>
                                                <select value={newDbForm.engine || 'POSTGRES'} onChange={e => setNewDbForm(f => ({ ...f, engine: e.target.value as any }))} className="w-full bg-black border border-gray-800 rounded p-2 text-white text-sm">
                                                    <option value="POSTGRES">PostgreSQL</option>
                                                    <option value="MYSQL">MySQL</option>
                                                    <option value="REDIS">Redis</option>
                                                </select>
                                            </div>
                                        </div>
                                        <button type="submit" className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors border border-gray-700">
                                            + Queue Database
                                        </button>
                                    </form>
                                </div>
                            )}
                        </div>
                    ) : step === 'connections' ? (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-400">We've generated predictable internal hostnames for your new services. Review the suggested environment variables below.</p>

                            {suggestions.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 text-sm border border-gray-800 rounded-xl">
                                    No clear wiring suggestions found based on selected roles.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {newServices.map(svc => {
                                        const svcSuggs = suggestions.filter(s => s.fromTempId === svc.tempId);
                                        if (svcSuggs.length === 0) return null;

                                        return (
                                            <div key={svc.tempId} className="border border-gray-800 rounded-xl overflow-hidden">
                                                <div className="bg-gray-800/50 p-2.5 text-sm font-medium text-white border-b border-gray-800">
                                                    Variables for <span className="text-blue-400">{svc.name}</span>
                                                </div>
                                                <div className="divide-y divide-gray-800 bg-black/20">
                                                    {svcSuggs.map((s, i) => (
                                                        <div key={i} className="p-3 text-sm grid grid-cols-3 gap-4">
                                                            <div className="text-gray-400 font-mono text-xs break-all">{s.envKey}</div>
                                                            <div className="col-span-2 text-green-400 font-mono text-xs break-all">{s.envValue} {s.isPlaceholder && <span className="text-gray-500">(placeholder, will be real creds)</span>}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {!appliedSuggestions ? (
                                        <button onClick={applySuggestions} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors">
                                            Apply Suggested Variables
                                        </button>
                                    ) : (
                                        <div className="w-full py-3 bg-green-500/10 text-green-400 border border-green-500/20 rounded-xl text-sm font-medium text-center">
                                            ✓ Variables applied
                                        </div>
                                    )}
                                </div>
                            )}

                            {newServices.length > 0 && (
                                <div className="mt-6 border border-gray-800 rounded-xl p-4">
                                    <h4 className="text-sm font-medium text-white mb-3">Which service should be public? (Entrypoint)</h4>
                                    <div className="space-y-2">
                                        {newServices.map(svc => (
                                            <label key={svc.tempId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/50 cursor-pointer">
                                                <input type="radio" name="entrypoint" checked={publicEntryPoint === svc.tempId} onChange={() => setPublicEntryPoint(svc.tempId)} className="text-blue-500 focus:ring-blue-500 bg-black border-gray-700" />
                                                <span className="text-sm text-white">{svc.name} <span className="text-gray-500 text-xs">({svc.role})</span></span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : step === 'review' ? (
                        <div className="space-y-4">
                            <div className="bg-black/40 border border-gray-800 rounded-xl p-4 space-y-4">
                                <div>
                                    <span className="text-xs text-gray-500 uppercase tracking-wider">Stack</span>
                                    <p className="text-white font-semibold text-lg">{name}</p>
                                </div>

                                <div className="border-t border-gray-800 pt-3 grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Services ({selectedProjects.length + newServices.length})</span>
                                        <div className="space-y-1">
                                            {selectedProjects.map(id => {
                                                const p = existingProjects.find(pr => pr.id === id);
                                                return p ? <div key={id} className="text-sm text-gray-300">🔗 {p.name} <span className="text-gray-600 text-xs">(Existing)</span></div> : null;
                                            })}
                                            {newServices.map(s => (
                                                <div key={s.tempId} className="text-sm text-white">✨ {s.name} <span className="text-blue-400 text-xs">({s.role})</span></div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Databases ({selectedDatabases.length + newDatabases.length})</span>
                                        <div className="space-y-1">
                                            {selectedDatabases.map(id => {
                                                const d = existingDatabases.find(db => db.id === id);
                                                return d ? <div key={id} className="text-sm text-gray-300">🔗 {d.name} <span className="text-gray-600 text-xs">({d.engine})</span></div> : null;
                                            })}
                                            {newDatabases.map(d => (
                                                <div key={d.tempId} className="text-sm text-green-400">✨ {d.name} <span className="text-green-600 text-xs">({d.engine})</span></div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {newDatabases.length > 0 && (
                                <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500/90 p-3 rounded-lg text-xs flex gap-2">
                                    <span className="text-base">⚠️</span>
                                    <span>Provisioning new databases takes 30-120 seconds. This will happen automatically before your services are registered.</span>
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>

                {/* Footer */}
                {!isCreating && (
                    <div className="p-4 border-t border-gray-800/50 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={stepIndex === 0 ? onClose : goBack}
                            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                        >
                            {stepIndex === 0 ? 'Cancel' : '← Back'}
                        </button>

                        {step === 'review' ? (
                            <button
                                onClick={handleCreate}
                                disabled={loading}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20"
                            >
                                🚀 Create & Launch
                            </button>
                        ) : (
                            <button
                                onClick={goNext}
                                disabled={!canProceed()}
                                className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-30 border border-gray-700"
                            >
                                Continue →
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
