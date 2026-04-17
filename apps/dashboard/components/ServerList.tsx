'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import AddServerModal from './AddServerModal';
import AddProjectModal from './AddProjectModal';

const ProvisionTerminalModal = dynamic(() => import('./ProvisionTerminalModal'), {
    ssr: false,
});
import Link from 'next/link';

interface Project {
    id: string;
    name: string;
}

interface Server {
    id: string;
    name: string;
    ip: string;
    projects?: Project[];
}

import { useAuth } from '@/providers/auth.provider';

export default function ServerList() {
    const { token } = useAuth();
    const [servers, setServers] = useState<Server[]>([]);
    const [loading, setLoading] = useState(true);
    const [isServerModalOpen, setIsServerModalOpen] = useState(false);
    const [provisionModal, setProvisionModal] = useState<{ open: boolean; serverId: string; serverName: string }>({
        open: false,
        serverId: '',
        serverName: '',
    });
    const [projectModal, setProjectModal] = useState<{ open: boolean; serverId: string; serverName: string }>({
        open: false,
        serverId: '',
        serverName: '',
    });

    const fetchServers = useCallback(() => {
        if (!token) return;
        setLoading(true);
        fetch('/api/servers', {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) setServers(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error('Failed to fetch servers:', err);
                setLoading(false);
            });
    }, [token]);

    useEffect(() => {
        if (token) fetchServers();
    }, [fetchServers, token]);

    if (loading && servers.length === 0) return <div className="text-gray-400">Loading servers...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Your Servers</h2>
                <button
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md transition-colors"
                    onClick={() => setIsServerModalOpen(true)}
                >
                    + Add Server
                </button>
            </div>

            <AddServerModal
                isOpen={isServerModalOpen}
                onClose={() => setIsServerModalOpen(false)}
                onAdded={() => {
                    fetchServers();
                }}
            />

            <AddProjectModal
                isOpen={projectModal.open}
                onClose={() => setProjectModal({ open: false, serverId: '', serverName: '' })}
                serverId={projectModal.serverId}
                serverName={projectModal.serverName}
                onAdded={() => {
                    fetchServers();
                }}
            />

            <ProvisionTerminalModal
                isOpen={provisionModal.open}
                onClose={() => setProvisionModal({ open: false, serverId: '', serverName: '' })}
                serverId={provisionModal.serverId}
                serverName={provisionModal.serverName}
            />

            {servers.length === 0 ? (
                <div className="text-center py-24 glass rounded-[32px] border-dashed border-white/10 animate-reveal">
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl">
                        📡
                    </div>
                    <p className="text-white font-bold text-xl mb-2">No servers connected</p>
                    <p className="text-gray-400 mb-8 max-w-sm mx-auto">Connect your first VPS to start deploying high-performance applications with Hylius.</p>
                    <button
                        className="px-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all"
                        onClick={() => setIsServerModalOpen(true)}
                    >
                        Add your first server
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {servers.map((server, idx) => (
                        <div
                            key={server.id}
                            className="glass p-8 rounded-2xl hover:border-blue-500/50 hover:bg-neutral-900/50 transition-all duration-300 hover:-translate-y-1 group animate-reveal hover:glow-blue relative"
                            style={{ animationDelay: `${idx * 100}ms` }}
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div className="space-y-1">
                                    <Link href={`/servers/${server.id}`}>
                                        <h3 className="font-display font-bold text-xl text-white group-hover:text-blue-400 transition-colors tracking-tight">{server.name}</h3>
                                    </Link>
                                    <p className="text-xs font-mono text-gray-400 group-hover:text-gray-300 tracking-wider uppercase transition-colors">{server.ip}</p>
                                </div>
                                <div className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>
                                </div>
                            </div>

                            {/* Project Count */}
                            <div className="mb-8 flex items-center gap-2">
                                <div className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    {server.projects && server.projects.length > 0
                                        ? `${server.projects.length} Project${server.projects.length > 1 ? 's' : ''}`
                                        : 'No Projects'}
                                </div>
                                <div className="h-px flex-1 bg-white/5"></div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() =>
                                        setProvisionModal({
                                            open: true,
                                            serverId: server.id,
                                            serverName: server.name,
                                        })
                                    }
                                    className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 text-xs font-bold py-3 rounded-xl transition-all"
                                >
                                    Provision
                                </button>
                                <button
                                    onClick={() =>
                                        setProjectModal({
                                            open: true,
                                            serverId: server.id,
                                            serverName: server.name,
                                        })
                                    }
                                    className="bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-bold py-3 rounded-xl transition-all"
                                >
                                    + Project
                                </button>
                                <Link
                                    href={`/servers/${server.id}`}
                                    className="col-span-2 bg-white/5 hover:bg-white/10 text-xs font-bold py-3 rounded-xl text-gray-300 transition-all text-center border border-white/5"
                                >
                                    View Details
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
