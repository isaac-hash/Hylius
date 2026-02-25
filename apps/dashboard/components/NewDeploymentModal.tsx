'use client';

import { useState, useEffect } from 'react';

interface Project {
    id: string;
    name: string;
    server?: { name: string };
}

interface NewDeploymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    preSelectedProjectId?: string;
    onDeploy?: (projectId: string) => void;
}

export default function NewDeploymentModal({ isOpen, onClose, preSelectedProjectId, onDeploy }: NewDeploymentModalProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState(preSelectedProjectId || '');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        // Fetch projects from API
        fetch('/api/projects')
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    setProjects(data);
                    if (!preSelectedProjectId && data.length > 0) {
                        setSelectedProjectId(data[0].id);
                    }
                }
            })
            .catch(console.error);
    }, [isOpen, preSelectedProjectId]);

    if (!isOpen) return null;

    const handleDeploy = () => {
        if (!selectedProjectId) return;
        setLoading(true);

        // Pass the projectId to the parent instead of emitting on socket directly
        onDeploy?.(selectedProjectId);

        setLoading(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-lg w-full max-w-sm">
                <h2 className="text-xl font-bold text-white mb-4">Start New Deployment</h2>

                <p className="text-gray-400 mb-6 text-sm">
                    This will trigger a new deployment for the selected project.
                </p>

                {!preSelectedProjectId && projects.length > 0 && (
                    <div className="mb-4">
                        <label className="block text-sm text-gray-400 mb-1">Select Project</label>
                        <select
                            className="w-full bg-black border border-gray-800 rounded p-2 text-white focus:border-blue-600 focus:outline-none transition-colors"
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                        >
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name} {p.server ? `(${p.server.name})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {projects.length === 0 && !preSelectedProjectId && (
                    <p className="text-gray-500 text-sm mb-4">
                        No projects found. Add a project to a server first.
                    </p>
                )}

                <div className="flex justify-end gap-2 mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleDeploy}
                        disabled={loading || !selectedProjectId}
                        className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Starting...' : 'Deploy Now'}
                    </button>
                </div>
            </div>
        </div>
    );
}
