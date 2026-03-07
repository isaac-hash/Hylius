'use client';

import { useState, useEffect, useCallback } from 'react';

interface Domain {
    id: string;
    hostname: string;
    status: string;
    sslStatus: string;
    errorMessage: string | null;
    createdAt: string;
}

interface DomainManagerProps {
    projectId: string;
    serverIp: string;
    token: string | null;
}

export default function DomainManager({ projectId, serverIp, token }: DomainManagerProps) {
    const [domains, setDomains] = useState<Domain[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newHostname, setNewHostname] = useState('');
    const [addError, setAddError] = useState('');
    const [addLoading, setAddLoading] = useState(false);
    const [verifyingDomain, setVerifyingDomain] = useState<string | null>(null);
    const [deletingDomain, setDeletingDomain] = useState<string | null>(null);
    const [dnsInstructions, setDnsInstructions] = useState<{ hostname: string; ip: string } | null>(null);

    const fetchDomains = useCallback(async () => {
        if (!token) return;
        try {
            const res = await fetch(`/api/projects/${projectId}/domains`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setDomains(data);
            }
        } catch {
            // Silently fail
        } finally {
            setLoading(false);
        }
    }, [projectId, token]);

    useEffect(() => {
        void fetchDomains();
    }, [fetchDomains]);

    const handleAddDomain = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newHostname.trim() || !token) return;

        setAddLoading(true);
        setAddError('');
        setDnsInstructions(null);

        try {
            const res = await fetch(`/api/projects/${projectId}/domains`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ hostname: newHostname.trim().toLowerCase() }),
            });

            const data = await res.json();

            if (!res.ok) {
                setAddError(data.error || 'Failed to add domain');
                return;
            }

            if (data.dnsInstructions) {
                setDnsInstructions({ hostname: data.dnsInstructions.name, ip: data.dnsInstructions.value });
            }

            setNewHostname('');
            setShowAddForm(false);
            fetchDomains();
        } catch (err: unknown) {
            setAddError(err instanceof Error ? err.message : 'Failed to add domain');
        } finally {
            setAddLoading(false);
        }
    };

    const handleVerify = async (hostname: string) => {
        if (!token) return;
        setVerifyingDomain(hostname);

        try {
            const res = await fetch(`/api/projects/${projectId}/domains/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ hostname }),
            });

            const data = await res.json();

            if (data.verified) {
                setDnsInstructions(null);
            } else if (data.dnsInstructions) {
                setDnsInstructions({ hostname: data.dnsInstructions.name, ip: data.dnsInstructions.value });
            }

            fetchDomains();
        } catch {
            // Silently fail
        } finally {
            setVerifyingDomain(null);
        }
    };

    const handleDelete = async (hostname: string) => {
        if (!token || !confirm(`Remove domain ${hostname}?`)) return;
        setDeletingDomain(hostname);

        try {
            await fetch(`/api/projects/${projectId}/domains`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ hostname }),
            });
            fetchDomains();
        } catch {
            // Silently fail
        } finally {
            setDeletingDomain(null);
        }
    };

    const statusBadge = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return <span className="flex items-center gap-1 text-xs text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>Active</span>;
            case 'DNS_VERIFIED':
                return <span className="flex items-center gap-1 text-xs text-blue-400"><span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>DNS OK</span>;
            case 'PENDING':
                return <span className="flex items-center gap-1 text-xs text-yellow-400"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>Pending</span>;
            case 'ERROR':
                return <span className="flex items-center gap-1 text-xs text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>Error</span>;
            default:
                return <span className="text-xs text-gray-500">{status}</span>;
        }
    };

    if (loading) return null;

    return (
        <div className="border-t border-gray-800 bg-gray-950/50 px-5 py-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                    Domains {domains.length > 0 && `(${domains.length})`}
                </h4>
                <button
                    onClick={() => { setShowAddForm(!showAddForm); }}
                    className="text-xs px-2.5 py-1 rounded-md bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center gap-1"
                >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add Domain
                </button>
            </div>

            {/* Add Domain Form */}
            {showAddForm && (
                <form onSubmit={handleAddDomain} className="mb-3 flex gap-2">
                    <input
                        type="text"
                        value={newHostname}
                        onChange={(e) => { setNewHostname(e.target.value); }}
                        placeholder="myapp.com"
                        className="flex-1 bg-gray-900 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                        disabled={addLoading}
                    />
                    <button
                        type="submit"
                        disabled={addLoading || !newHostname.trim()}
                        className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                        {addLoading ? (
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : 'Add'}
                    </button>
                    <button
                        type="button"
                        onClick={() => { setShowAddForm(false); setAddError(''); setNewHostname(''); }}
                        className="px-2 py-1.5 rounded-md text-gray-400 hover:text-white text-sm transition-colors"
                    >
                        Cancel
                    </button>
                </form>
            )}

            {addError && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2 mb-3">
                    {addError}
                </div>
            )}

            {/* DNS Instructions Banner */}
            {dnsInstructions && (
                <div className="text-xs bg-yellow-500/10 border border-yellow-500/20 rounded-md px-3 py-2 mb-3">
                    <p className="text-yellow-400 font-medium mb-1">DNS Configuration Needed</p>
                    <p className="text-yellow-300/70">
                        Add an <span className="font-mono font-bold">A</span> record for <span className="font-mono">{dnsInstructions.hostname}</span> pointing to <span className="font-mono">{dnsInstructions.ip}</span>
                    </p>
                </div>
            )}

            {/* Domain List */}
            {domains.length > 0 ? (
                <div className="space-y-2">
                    {domains.map((domain) => (
                        <div key={domain.id} className="flex items-center justify-between bg-gray-900/50 rounded-md px-3 py-2 border border-gray-800/50">
                            <div className="flex items-center gap-3">
                                {statusBadge(domain.status)}
                                {domain.status === 'ACTIVE' ? (
                                    <a
                                        href={`https://${domain.hostname}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sm text-blue-400 hover:text-blue-300 hover:underline font-mono"
                                    >
                                        {domain.hostname}
                                    </a>
                                ) : (
                                    <span className="text-sm text-gray-300 font-mono">{domain.hostname}</span>
                                )}
                                {domain.status === 'ACTIVE' && domain.sslStatus === 'ACTIVE' && (
                                    <span className="text-xs text-green-500 flex items-center gap-0.5">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                        SSL
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5">
                                {(domain.status === 'PENDING' || domain.status === 'ERROR') && (
                                    <button
                                        onClick={() => handleVerify(domain.hostname)}
                                        disabled={verifyingDomain === domain.hostname}
                                        className="text-xs px-2 py-1 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-colors disabled:opacity-50"
                                    >
                                        {verifyingDomain === domain.hostname ? 'Checking...' : 'Verify'}
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDelete(domain.hostname)}
                                    disabled={deletingDomain === domain.hostname}
                                    className="p-1 rounded text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
                                    title="Remove domain"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : !showAddForm && (
                <p className="text-xs text-gray-600 italic">No custom domains configured.</p>
            )}

            {domains.length > 0 && (
                <p className="text-xs text-gray-600 mt-2">
                    Tip: Use <span className="font-mono">app.{serverIp.replace(/\./g, '-')}.sslip.io</span> for free testing
                </p>
            )}
        </div>
    );
}
