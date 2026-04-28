'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/auth.provider';

interface AddServerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdded: () => void;
}

export default function AddServerModal({ isOpen, onClose, onAdded }: AddServerModalProps) {
    const { token } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        ip: '',
    });
    
    // State to hold the created server info for step 2
    const [createdServer, setCreatedServer] = useState<{ id: string; agentToken: string; status: string } | null>(null);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setFormData({ name: '', ip: '' });
            setCreatedServer(null);
            setLoading(false);
        }
    }, [isOpen]);

    // Poll for agent status once server is created
    useEffect(() => {
        if (!createdServer || createdServer.status === 'ONLINE' || !isOpen) return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/servers/${createdServer.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === 'ONLINE') {
                        setCreatedServer(prev => prev ? { ...prev, status: 'ONLINE' } : null);
                        clearInterval(interval);
                    }
                }
            } catch (e) {
                console.error('Polling error', e);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [createdServer, token, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/servers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(formData),
            });

            if (!res.ok) throw new Error(await res.text());
            
            const newServer = await res.json();
            setCreatedServer({
                id: newServer.id,
                agentToken: newServer.agentToken,
                status: newServer.status || 'UNKNOWN'
            });
            // We do NOT call onAdded or onClose yet.
        } catch (err: any) {
            alert('Failed to add server: ' + err.message);
        } finally {
            setLoading(false);
        }
    };
    
    const handleDone = () => {
        onAdded();
        onClose();
    };

    const installCmd = createdServer 
        ? `curl -sSL https://github.com/Hylius-org/hylius-agent/releases/latest/download/install.sh | bash -s -- --token ${createdServer.agentToken} --server-url ${typeof window !== 'undefined' ? window.location.origin : 'https://dashboard.hylius.icu'} --server-id ${createdServer.id}`
        : '';

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-lg w-full max-w-2xl">
                {!createdServer ? (
                    <>
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
                            Connect New Server
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Server Name <span className="text-red-400">*</span></label>
                                <input
                                    className="w-full bg-black border border-gray-800 rounded-lg p-2.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="My Production VPS"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">IP Address <span className="text-gray-500 text-xs font-normal">(Optional, for labeling)</span></label>
                                <input
                                    className="w-full bg-black border border-gray-800 rounded-lg p-2.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="203.0.113.1"
                                    value={formData.ip}
                                    onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                                />
                            </div>

                            <div className="flex justify-end gap-3 mt-8">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || !formData.name.trim()}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Generating...
                                        </>
                                    ) : (
                                        'Generate Install Command'
                                    )}
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Server Created
                            </h2>
                            {createdServer.status === 'ONLINE' ? (
                                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]">
                                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                                    Agent Connected!
                                </span>
                            ) : (
                                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    <div className="w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
                                    Waiting for agent...
                                </span>
                            )}
                        </div>

                        <div className="space-y-6">
                            <div>
                                <p className="text-sm text-gray-300 mb-3 leading-relaxed">
                                    Run this command on your VPS (as root) to install the Hylius Agent and securely connect it to the dashboard.
                                </p>
                                <div className="relative group">
                                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-violet-500 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                                    <div className="relative flex items-stretch bg-[#0a0a0a] border border-gray-800 rounded-lg overflow-hidden">
                                        <code className="flex-1 p-4 text-sm text-green-400 font-mono break-all leading-relaxed">
                                            {installCmd}
                                        </code>
                                        <button
                                            onClick={() => navigator.clipboard.writeText(installCmd)}
                                            className="px-4 bg-gray-800/50 hover:bg-gray-700/80 text-gray-300 hover:text-white transition-colors border-l border-gray-800 flex items-center justify-center min-w-[80px]"
                                            title="Copy command"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex gap-3">
                                <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="text-sm text-blue-200/80">
                                    This uses an outbound WebSocket connection. You do not need to open any inbound firewall ports (like port 22) for the dashboard to connect.
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end mt-8">
                            <button
                                onClick={handleDone}
                                className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                    createdServer.status === 'ONLINE'
                                        ? 'bg-green-600 hover:bg-green-500 text-white shadow-[0_0_15px_rgba(22,163,74,0.3)]'
                                        : 'bg-gray-800 hover:bg-gray-700 text-white'
                                }`}
                            >
                                {createdServer.status === 'ONLINE' ? 'Done' : 'Close & Wait in Background'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
