'use client';

import { useState } from 'react';
import { useAuth } from '@/providers/auth.provider';

interface AddProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    serverId: string;
    serverName: string;
    onAdded?: () => void;
}

export default function AddProjectModal({ isOpen, onClose, serverId, serverName, onAdded }: AddProjectModalProps) {
    const { token } = useAuth();
    const [form, setForm] = useState({
        name: '',
        repoUrl: '',
        branch: 'main',
        deployPath: '',
        buildCommand: '',
        startCommand: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ ...form, serverId }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create project');
            }

            setForm({ name: '', repoUrl: '', branch: 'main', deployPath: '', buildCommand: '', startCommand: '' });
            onAdded?.();
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

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-lg w-full max-w-md">
                <h2 className="text-xl font-bold text-white mb-1">Add Project</h2>
                <p className="text-gray-500 text-sm mb-5">
                    Deploying to <span className="text-gray-300">{serverName}</span>
                </p>

                {error && (
                    <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm p-3 rounded mb-4">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3">
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
            </div>
        </div>
    );
}
