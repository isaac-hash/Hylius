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
                <div className="text-center py-12 bg-gray-900/50 rounded-lg border border-gray-800">
                    <p className="text-gray-400 mb-4">No servers connected yet.</p>
                    <p className="text-sm text-gray-500">Connect a VPS to start deploying.</p>
                    <button
                        className="mt-4 text-blue-400 hover:text-blue-300 underline"
                        onClick={() => setIsServerModalOpen(true)}
                    >
                        Add your first server
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {servers.map((server) => (
                        <div
                            key={server.id}
                            className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-colors"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-semibold text-lg text-white">{server.name}</h3>
                                    <p className="text-sm text-gray-400">{server.ip}</p>
                                </div>
                                <span className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                            </div>

                            {/* Project Count */}
                            <div className="mb-4 text-sm text-gray-500">
                                {server.projects && server.projects.length > 0
                                    ? `${server.projects.length} project${server.projects.length > 1 ? 's' : ''}`
                                    : 'No projects'}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() =>
                                        setProvisionModal({
                                            open: true,
                                            serverId: server.id,
                                            serverName: server.name,
                                        })
                                    }
                                    className="flex-1 bg-blue-900/30 hover:bg-blue-800/40 text-blue-400 border border-blue-900/50 text-sm py-2 rounded transition-colors"
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
                                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-sm py-2 rounded text-gray-300 transition-colors"
                                >
                                    + Project
                                </button>
                                <Link
                                    href="/deployments"
                                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-sm py-2 rounded text-gray-300 transition-colors text-center"
                                >
                                    Logs
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
