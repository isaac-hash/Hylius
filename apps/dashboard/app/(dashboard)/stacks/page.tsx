"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { useAuth } from "@/providers/auth.provider";
import CreateStackModal from "@/components/CreateStackModal";

interface StackItem {
    id: string;
    name: string;
    description: string | null;
    status: string;
    server: { id: string; name: string; ip: string };
    _count: { projects: number; databases: number };
    createdAt: string;
}

function getStatusColor(status: string) {
    switch (status) {
        case 'ACTIVE': return 'bg-green-500/10 text-green-400 border-green-500/20';
        case 'DEPLOYING': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        case 'ERROR': return 'bg-red-500/10 text-red-400 border-red-500/20';
        default: return 'bg-gray-800 text-gray-400 border-gray-700';
    }
}

function getStatusDot(status: string) {
    switch (status) {
        case 'ACTIVE': return 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]';
        case 'DEPLOYING': return 'bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.6)] animate-pulse';
        case 'ERROR': return 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]';
        default: return 'bg-gray-500';
    }
}

export default function StacksPage() {
    const { token } = useAuth();
    const [stacks, setStacks] = useState<StackItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    // Delete state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteWipe, setDeleteWipe] = useState(false);
    const [stackToDelete, setStackToDelete] = useState<{id: string, name: string} | null>(null);

    const fetchStacks = useCallback(async () => {
        try {
            const res = await fetch('/api/stacks', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            setStacks(data);
        } catch {
            console.error('Failed to fetch stacks');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (token) fetchStacks();
    }, [token, fetchStacks]);

    function openDeleteModal(stackId: string, stackName: string) {
        setStackToDelete({ id: stackId, name: stackName });
        setDeleteWipe(false);
        setShowDeleteModal(true);
    }

    async function confirmDeleteStack() {
        if (!stackToDelete) return;
        try {
            await fetch(`/api/stacks/${stackToDelete.id}?wipe=${deleteWipe}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            setStacks(prev => prev.filter(s => s.id !== stackToDelete.id));
            setShowDeleteModal(false);
            setStackToDelete(null);
        } catch {
            alert('Failed to delete stack');
        }
    }

    return (
        <AuthGuard>
            <div className="min-h-screen bg-background text-foreground selection:bg-blue-500/30">
                <main className="py-6">
                    <header className="mb-8 flex items-start justify-between animate-reveal">
                        <div>
                            <h1 className="font-display text-4xl font-bold mb-2 tracking-tight text-white">Stacks</h1>
                            <p className="text-gray-400 max-w-2xl">Group your services into applications. Deploy everything together.</p>
                        </div>
                        <button
                            onClick={() => setShowCreate(true)}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 5v14M5 12h14" />
                            </svg>
                            Create Stack
                        </button>
                    </header>

                    {loading ? (
                        <div className="flex items-center justify-center py-20 text-gray-500">
                            <div className="w-6 h-6 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin mr-3" />
                            Loading stacks...
                        </div>
                    ) : stacks.length === 0 ? (
                        <div className="text-center py-20 animate-reveal">
                            <div className="w-20 h-20 mx-auto mb-6 bg-gray-800/50 rounded-2xl flex items-center justify-center border border-gray-700/50">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
                                    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                                    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                                    <line x1="6" y1="6" x2="6.01" y2="6" />
                                    <line x1="6" y1="18" x2="6.01" y2="18" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">No stacks yet</h3>
                            <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
                                Stacks group your services (frontend, backend, database) into a single application.
                            </p>
                            <button
                                onClick={() => setShowCreate(true)}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-500/20"
                            >
                                Create your first Stack
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-reveal">
                            {stacks.map(stack => (
                                <div
                                    key={stack.id}
                                    className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all group"
                                >
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className={`w-2 h-2 rounded-full ${getStatusDot(stack.status)}`} />
                                                <Link
                                                    href={`/stacks/${stack.id}`}
                                                    className="text-white font-semibold text-base truncate hover:text-blue-400 transition-colors"
                                                >
                                                    {stack.name}
                                                </Link>
                                            </div>
                                            {stack.description && (
                                                <p className="text-gray-500 text-xs truncate">{stack.description}</p>
                                            )}
                                        </div>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider font-medium ${getStatusColor(stack.status)}`}>
                                            {stack.status}
                                        </span>
                                    </div>

                                    {/* Stats */}
                                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                                        <div className="flex items-center gap-1.5">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                                <path d="M2 17l10 5 10-5" />
                                                <path d="M2 12l10 5 10-5" />
                                            </svg>
                                            <span>{stack._count.projects} service{stack._count.projects !== 1 ? 's' : ''}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <ellipse cx="12" cy="5" rx="9" ry="3" />
                                                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                                                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                                            </svg>
                                            <span>{stack._count.databases} db{stack._count.databases !== 1 ? 's' : ''}</span>
                                        </div>
                                    </div>

                                    {/* Server badge */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-800/50 px-2 py-1 rounded-lg">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                                                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                                            </svg>
                                            <span>{stack.server.name}</span>
                                        </div>

                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Link
                                                href={`/stacks/${stack.id}`}
                                                className="text-xs text-gray-500 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
                                            >
                                                View
                                            </Link>
                                            <button
                                                onClick={() => openDeleteModal(stack.id, stack.name)}
                                                className="text-xs text-gray-500 hover:text-red-400 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>

            <CreateStackModal
                isOpen={showCreate}
                onClose={() => setShowCreate(false)}
                onCreated={() => fetchStacks()}
            />

            {/* Delete Stack Modal */}
            {showDeleteModal && stackToDelete && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-2">Delete Stack: {stackToDelete.name}</h2>
                        <p className="text-sm text-gray-400 mb-6">How do you want to handle the resources inside this stack?</p>

                        <div className="space-y-3 mb-6">
                            <label className={`block p-4 rounded-xl border cursor-pointer transition-all ${!deleteWipe ? 'border-blue-500 bg-blue-500/10' : 'border-gray-800 bg-black/50 hover:border-gray-600'}`}>
                                <div className="flex items-center gap-3">
                                    <input type="radio" checked={!deleteWipe} onChange={() => setDeleteWipe(false)} className="text-blue-500 focus:ring-blue-500 bg-black border-gray-700" />
                                    <div>
                                        <div className="text-sm font-medium text-white">Unlink Only (Safe)</div>
                                        <div className="text-xs text-gray-400 mt-0.5">Stack is deleted, but services and databases keep running normally.</div>
                                    </div>
                                </div>
                            </label>

                            <label className={`block p-4 rounded-xl border cursor-pointer transition-all ${deleteWipe ? 'border-red-500 bg-red-500/10' : 'border-gray-800 bg-black/50 hover:border-gray-600'}`}>
                                <div className="flex items-center gap-3">
                                    <input type="radio" checked={deleteWipe} onChange={() => setDeleteWipe(true)} className="text-red-500 focus:ring-red-500 bg-black border-gray-700" />
                                    <div>
                                        <div className="text-sm font-medium text-red-400">Complete Wipe (Destructive)</div>
                                        <div className="text-xs text-red-400/70 mt-0.5">Stack, all projects, and all databases are permanently destroyed and pruned from the server.</div>
                                    </div>
                                </div>
                            </label>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                            <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                                Cancel
                            </button>
                            <button onClick={confirmDeleteStack} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all text-white ${deleteWipe ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/20' : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20'}`}>
                                {deleteWipe ? 'Wipe Everything' : 'Delete Stack'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthGuard>
    );
}
