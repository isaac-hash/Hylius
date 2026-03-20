'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/auth.provider';

interface AddProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    serverId: string;
    serverName: string;
    onAdded?: (projectId?: string, successData?: { token: string; webhookUrl: string; prUrl?: string | null }) => void;
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

export default function AddProjectModal({ isOpen, onClose, serverId, serverName, onAdded }: AddProjectModalProps) {
    const { token } = useAuth();
    const [mode, setMode] = useState<'manual' | 'github'>('manual');
    const [form, setForm] = useState({
        name: '',
        repoUrl: '',
        branch: 'main',
        deployPath: '',
        buildCommand: '',
        startCommand: '',
    });
    const [githubMeta, setGithubMeta] = useState<{ repoFullName: string; installationId: number } | null>(null);
    const [deployStrategy, setDeployStrategy] = useState<'auto' | 'dagger' | 'ghcr-pull' | 'compose-registry' | 'compose-server'>('auto');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // GitHub repo state
    const [repos, setRepos] = useState<GitHubRepo[]>([]);
    const [reposLoading, setReposLoading] = useState(false);
    const [githubConnected, setGithubConnected] = useState(false);
    const [installationId, setInstallationId] = useState<number>(0);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (isOpen && mode === 'github' && repos.length === 0) {
            fetchRepos();
        }
    }, [isOpen, mode]);

    if (!isOpen) return null;

    async function fetchRepos() {
        setReposLoading(true);
        try {
            const res = await fetch('/api/github/repos', {
                headers: { Authorization: `Bearer ${token}` },
            });
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
            setError('Failed to fetch GitHub repos');
        } finally {
            setReposLoading(false);
        }
    }

    function selectRepo(repo: GitHubRepo) {
        setForm({
            name: repo.name,
            repoUrl: repo.cloneUrl,
            branch: repo.defaultBranch,
            deployPath: `/var/www/${repo.name}`,
            buildCommand: '',
            startCommand: '',
        });
        setGithubMeta({
            repoFullName: repo.fullName,
            installationId: installationId,
        });
        setDeployStrategy('auto');
        // Switch to manual for final review/edit
        setMode('manual');
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const body: Record<string, unknown> = { ...form, serverId };
            if (githubMeta) {
                body.githubRepoFullName = githubMeta.repoFullName;
                body.githubInstallationId = githubMeta.installationId;
                body.deployStrategy = deployStrategy;
            }

            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to create project');
            }

            const projectData = await res.json();

            if (deployStrategy === 'dagger' || deployStrategy === 'ghcr-pull' || deployStrategy === 'compose-registry') {
                // Generate a deployment token automatically
                const tokenRes = await fetch('/api/tokens', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ name: `GitHub Actions - ${form.name}` })
                });

                let deployToken = 'Failed to generate token';
                if (tokenRes.ok) {
                    const tokenData = await tokenRes.json();
                    deployToken = tokenData.token;
                }

                const successData = {
                    token: deployToken,
                    webhookUrl: `${window.location.origin}/api/webhooks/deploy-complete`,
                    prUrl: projectData.prUrl ?? null,
                };

                setForm({ name: '', repoUrl: '', branch: 'main', deployPath: '', buildCommand: '', startCommand: '' });
                setGithubMeta(null);
                setDeployStrategy('auto');
                onAdded?.(projectData.id, successData);
                onClose();
                return;
            }

            setForm({ name: '', repoUrl: '', branch: 'main', deployPath: '', buildCommand: '', startCommand: '' });
            setGithubMeta(null);
            setDeployStrategy('auto');
            onAdded?.(projectData.id);
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const fields = [
        { name: 'name', label: 'Project Name', placeholder: 'my-app', required: true },
        { name: 'repoUrl', label: 'Repository URL', placeholder: 'https://github.com/user/repo.git', required: true },
        { name: 'branch', label: 'Branch', placeholder: 'main', required: false },
        { name: 'deployPath', label: 'Deploy Path', placeholder: '/var/www/my-app', required: true },
        { name: 'buildCommand', label: 'Build Command', placeholder: 'npm run build (optional)', required: false },
        { name: 'startCommand', label: 'Start Command', placeholder: 'npm start (optional)', required: false },
    ];

    const filteredRepos = repos.filter(r =>
        r.fullName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const appSlug = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG || 'hylius-platform';

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold text-white mb-1">Add Project</h2>
                <p className="text-gray-500 text-sm mb-4">
                    Deploying to <span className="text-gray-300">{serverName}</span>
                </p>

                {/* Mode Tabs */}
                <div className="flex gap-1 mb-5 bg-black/50 rounded-lg p-1 border border-gray-800">
                    <button
                        type="button"
                        onClick={() => setMode('manual')}
                        className={`flex-1 text-sm py-2 px-3 rounded-md transition-colors ${mode === 'manual'
                            ? 'bg-gray-800 text-white font-medium'
                            : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        Manual
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('github')}
                        className={`flex-1 text-sm py-2 px-3 rounded-md transition-colors flex items-center justify-center gap-1.5 ${mode === 'github'
                            ? 'bg-gray-800 text-white font-medium'
                            : 'text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.11.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                        </svg>
                        Import from GitHub
                    </button>
                </div>

                {error && (
                    <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm p-3 rounded mb-4">
                        {error}
                    </div>
                )}

                {/* GitHub Import Mode */}
                {mode === 'github' && (
                    <div>
                        {reposLoading ? (
                            <div className="flex items-center justify-center py-8 text-gray-500">
                                <div className="w-5 h-5 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin mr-2"></div>
                                Loading repos...
                            </div>
                        ) : !githubConnected ? (
                            <div className="text-center py-8">
                                <svg className="w-10 h-10 text-gray-600 mx-auto mb-3" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.11.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                                </svg>
                                <p className="text-gray-400 text-sm mb-3">GitHub App not connected yet</p>
                                <a
                                    href={`https://github.com/apps/${appSlug}/installations/new`}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white text-sm font-medium transition-colors"
                                >
                                    Connect GitHub
                                </a>
                            </div>
                        ) : (
                            <div>
                                <input
                                    type="text"
                                    placeholder="Search repositories..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full bg-black border border-gray-800 rounded p-2 text-white text-sm placeholder-gray-600 focus:border-blue-600 focus:outline-none transition-colors mb-3"
                                />
                                <div className="space-y-1 max-h-64 overflow-y-auto">
                                    {filteredRepos.length === 0 ? (
                                        <p className="text-gray-500 text-sm text-center py-4">No repos found</p>
                                    ) : (
                                        filteredRepos.map(repo => (
                                            <button
                                                key={repo.id}
                                                type="button"
                                                onClick={() => selectRepo(repo)}
                                                className="w-full text-left p-3 rounded-lg border border-gray-800 hover:border-blue-500/50 hover:bg-gray-800/50 transition-all group"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-white text-sm font-medium group-hover:text-blue-400 transition-colors">
                                                        {repo.fullName}
                                                    </span>
                                                    {repo.private && (
                                                        <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                                            Private
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1">
                                                    {repo.language && (
                                                        <span className="text-xs text-gray-500">{repo.language}</span>
                                                    )}
                                                    <span className="text-xs text-gray-600">{repo.defaultBranch}</span>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="flex justify-end pt-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Manual Mode */}
                {mode === 'manual' && (
                    <form onSubmit={handleSubmit} className="space-y-3">
                        {githubMeta && (
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 flex items-center gap-2 text-sm">
                                <svg className="w-4 h-4 text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.11.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                                </svg>
                                <span className="text-blue-300">
                                    Imported from <span className="font-medium">{githubMeta.repoFullName}</span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setGithubMeta(null)}
                                    className="ml-auto text-blue-400 hover:text-blue-300 text-xs"
                                >
                                    ✕
                                </button>
                            </div>
                        )}

                        {githubMeta && (
                            <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3">
                                <label className="block text-sm text-gray-400 mb-2 font-medium">Deployment Strategy</label>
                                <select
                                    value={deployStrategy}
                                    onChange={(e) => setDeployStrategy(e.target.value as any)}
                                    className="w-full bg-black border border-gray-700 rounded p-2 text-white text-sm focus:border-blue-600 focus:outline-none transition-colors"
                                >
                                    <option value="auto">Build on Server (Auto-detect / PM2 / Native Docker)</option>
                                    <option value="compose-server">Build on Server (Docker Compose)</option>
                                    <option value="dagger">⚡ Build with Dagger on GitHub Actions (Recommended)</option>
                                    <option value="ghcr-pull">Build on GitHub Actions (Native Docker — Legacy)</option>
                                    <option value="compose-registry">Build on GitHub Actions (Docker Compose)</option>
                                </select>
                                {deployStrategy === 'dagger' && (
                                    <p className="text-xs text-violet-400 mt-2">
                                        Hylius will open a <strong>Pull Request</strong> in your repo with a Dagger-powered pipeline. Merge it once — every push after that auto-builds on GitHub and deploys to your VPS with zero CPU load.
                                    </p>
                                )}
                                {(deployStrategy === 'ghcr-pull' || deployStrategy === 'compose-registry') && (
                                    <p className="text-xs text-blue-400 mt-2">
                                        Hylius will automatically commit a CI/CD workflow to your repository to build and push your Docker image using GitHub Actions.
                                    </p>
                                )}
                            </div>
                        )}

                        {fields.map((f) => (
                            <div key={f.name}>
                                <label className="block text-sm text-gray-400 mb-1">
                                    {f.label} {f.required && <span className="text-red-400">*</span>}
                                </label>
                                <input
                                    name={f.name}
                                    value={form[f.name as keyof typeof form]}
                                    onChange={handleChange}
                                    placeholder={f.placeholder}
                                    required={f.required}
                                    className="w-full bg-black border border-gray-800 rounded p-2 text-white text-sm placeholder-gray-600 focus:border-blue-600 focus:outline-none transition-colors"
                                />
                            </div>
                        ))}

                        <div className="flex justify-end gap-2 pt-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Creating...' : 'Add Project'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
