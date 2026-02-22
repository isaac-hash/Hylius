'use client';

import { useState } from 'react';
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
        port: '22',
        username: 'root',
        privateKey: '',
        osType: 'Ubuntu',
    });

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
                body: JSON.stringify({
                    ...formData,
                    port: parseInt(formData.port, 10) || 22
                }),
            });

            if (!res.ok) throw new Error(await res.text());

            onAdded();
            onClose();
        } catch (err) {
            alert('Failed to add server: ' + err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-lg w-full max-w-md">
                <h2 className="text-xl font-bold text-white mb-4">Connect New Server</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Server Name</label>
                        <input
                            className="w-full bg-black border border-gray-800 rounded p-2 text-white focus:border-blue-500 outline-none"
                            placeholder="My Production VPS"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-sm text-gray-400 mb-1">IP Address <span className="text-red-400">*</span></label>
                                <input
                                    required
                                    className="w-full bg-black border border-gray-800 rounded p-2 text-white focus:border-blue-500 outline-none"
                                    placeholder="203.0.113.1"
                                    value={formData.ip}
                                    onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                                />
                            </div>
                            <div className="w-24">
                                <label className="block text-sm text-gray-400 mb-1">Port <span className="text-red-400">*</span></label>
                                <input
                                    required
                                    type="number"
                                    className="w-full bg-black border border-gray-800 rounded p-2 text-white focus:border-blue-500 outline-none"
                                    placeholder="22"
                                    value={formData.port}
                                    onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Username</label>
                            <input
                                className="w-full bg-black border border-gray-800 rounded p-2 text-white focus:border-blue-500 outline-none"
                                placeholder="root"
                                value={formData.username}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Private Key (Paste contents here)</label>
                        <textarea
                            className="w-full h-32 bg-black border border-gray-800 rounded p-2 text-white focus:border-blue-500 outline-none font-mono text-xs"
                            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----\n..."
                            value={formData.privateKey}
                            onChange={(e) => setFormData({ ...formData, privateKey: e.target.value })}
                        />
                        <p className="text-xs text-gray-600 mt-1">Leave empty if using Password auth (coming soon)</p>
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-400 hover:text-white"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Connecting...' : 'Connect Server'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
