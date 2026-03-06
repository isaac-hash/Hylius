'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/auth.provider';

interface Installation {
    id: string;
    installationId: number;
    accountLogin: string;
    accountType: string;
}

interface GitHubConnectProps {
    compact?: boolean; // If true, shows a smaller inline version
}

export default function GitHubConnect({ compact = false }: GitHubConnectProps) {
    const { token } = useAuth();
    const [installation, setInstallation] = useState<Installation | null>(null);
    const [loading, setLoading] = useState(true);

    const appSlug = typeof window !== 'undefined'
        ? (process.env.NEXT_PUBLIC_GITHUB_APP_SLUG || 'hylius-platform')
        : 'hylius-platform';

    useEffect(() => {
        if (!token) return;

        const fetchRepos = async () => {
            setLoading(true);
            try {
                const res = await fetch('/api/github/repos', {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: 'no-store',
                });
                const data = await res.json();
                if (data.connected && data.installation) {
                    setInstallation(data.installation);
                }
            } catch (err) {
                console.error('Failed to fetch repos:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchRepos();
    }, [token]);

    const installUrl = `https://github.com/apps/${appSlug}/installations/new`;

    if (loading) {
        return (
            <div className={`flex items-center gap-2 text-gray-500 text-sm ${compact ? '' : 'p-4'}`}>
                <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                Checking GitHub connection...
            </div>
        );
    }

    if (installation) {
        return (
            <div className={`${compact ? 'flex items-center gap-3' : 'bg-gray-900/50 border border-gray-800 rounded-xl p-4'}`}>
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-300" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.11.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                    </svg>
                    <span className="text-green-400 text-sm font-medium flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                        Connected
                    </span>
                    <span className="text-gray-400 text-sm">@{installation.accountLogin}</span>
                </div>
                {!compact && (
                    <a
                        href={`https://github.com/settings/installations/${installation.installationId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 underline mt-2 block"
                    >
                        Manage GitHub App permissions →
                    </a>
                )}
            </div>
        );
    }

    return (
        <div className={`${compact ? '' : 'bg-gray-900/50 border border-gray-800 rounded-xl p-4'}`}>
            <a
                href={installUrl}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white text-sm font-medium transition-colors"
            >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.11.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                </svg>
                Connect GitHub
            </a>
            {!compact && (
                <p className="text-xs text-gray-500 mt-2">
                    Install the Hylius GitHub App to auto-deploy on push.
                </p>
            )}
        </div>
    );
}
