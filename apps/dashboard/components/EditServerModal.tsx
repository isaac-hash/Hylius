'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/auth.provider';

interface EditServerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdated: () => void;
    server: {
        id: string;
        name: string;
        ip: string;
        port: number;
        username: string;
        osType: string | null;
    } | null;
}

export default function EditServerModal({ isOpen, onClose, onUpdated, server }: EditServerModalProps) {
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

    useEffect(() => {
        if (server && isOpen) {
            setFormData({
                name: server.name || '',
                ip: server.ip || '',
                port: server.port ? server.port.toString() : '22',
                username: server.username || '',
                privateKey: '', // Leave blank, only update if provided
                osType: server.osType || 'Ubuntu',
            });
        }
    }, [server, isOpen]);

    if (!isOpen || !server) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch(`/api/servers/${server.id}`, {
                method: 'PUT',
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

            onUpdated();
            onClose();
        } catch (err: any) {
            alert('Failed to update server: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-lg w-full max-w-md">
                <h2 className="text-xl font-bold text-white mb-4">Edit Server</h2>
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
                        <label className="block text-sm text-gray-400 mb-1">Update Private Key</label>
                        <textarea
                            className="w-full h-32 bg-black border border-gray-800 rounded p-2 text-white focus:border-blue-500 outline-none font-mono text-xs"
                            placeholder="Optionally paste a new key to overwrite the current one."
                            value={formData.privateKey}
                            onChange={(e) => setFormData({ ...formData, privateKey: e.target.value })}
                        />
                        <p className="text-xs text-gray-600 mt-1">Leave empty to keep the current credentials.</p>
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
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
