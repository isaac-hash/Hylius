'use client';

import { use, useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/services/socket';
import { useAuth } from '@/providers/auth.provider';

function parseLogLine(raw: string): { text: string; type: 'info' | 'warn' | 'error' | 'command' | 'success' } {
    let type: 'info' | 'warn' | 'error' | 'command' | 'success' = 'info';
    if (raw.includes('\x1b[33m') || raw.includes('\x1b[1;33m')) type = 'warn';
    else if (raw.includes('\x1b[31m')) type = 'error';
    else if (raw.includes('\x1b[36m')) type = 'command';
    else if (raw.includes('\x1b[32m')) type = 'success';
    const text = raw.replace(/\x1b\[[0-9;]*m/g, '').replace(/\r/g, '');
    return { text, type };
}

function formatTimestamp(): string {
    const now = new Date();
    return now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
}

export default function DeploymentDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [deployment, setDeployment] = useState<any>(null);
    const [logs, setLogs] = useState<{ timestamp: string; text: string; type: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    const addLog = useCallback((raw: string) => {
        const lines = raw.split('\n').filter((l) => l.trim() !== '');
        const entries = lines.map((line) => {
            const { text, type } = parseLogLine(line);
            return { timestamp: formatTimestamp(), text, type };
        });
        if (entries.length > 0) {
            setLogs((prev) => [...prev, ...entries]);
        }
    }, []);

    const { token } = useAuth();

    useEffect(() => {
        const fetchDeployment = async () => {
            if (!token) return;
            try {
                const res = await fetch(`/api/deployments/${id}`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to fetch deployment');
                setDeployment(data);
                
                // If the deployment is already finished, load the history
                if (data.logContent) {
                    addLog(data.logContent);
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchDeployment();
    }, [id, addLog, token]);

    // Live streaming configuration
    useEffect(() => {
        if (!deployment || deployment.status === 'SUCCESS' || deployment.status === 'FAILED') {
            return;
        }

        const socket = getSocket();
        socket.on(`deployment_log_chunk:${id}`, (chunk: string) => {
            addLog(chunk);
        });

        return () => {
            socket.off(`deployment_log_chunk:${id}`);
        };
    }, [deployment, id, addLog]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-6">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error || !deployment) {
        return (
            <div className="min-h-screen bg-black p-6">
                <div className="text-red-400 bg-red-900/20 border border-red-500/20 p-4 rounded-lg">
                    {error || 'Deployment not found'}
                </div>
            </div>
        );
    }

    const typeStyles = {
        info: 'text-gray-300',
        warn: 'text-amber-300 bg-amber-500/8',
        error: 'text-red-400',
        command: 'text-cyan-400',
        success: 'text-green-400',
    };

    return (
        <div className="min-h-screen bg-black text-white md:p-10 p-4 font-sans">
            <div className="max-w-5xl mx-auto">
                <button
                    onClick={() => router.back()}
                    className="flex items-center text-gray-400 hover:text-white mb-6 text-sm transition-colors"
                >
                    &larr; Back to Dashboard
                </button>

                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Deploying {deployment.project.name}</h1>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                        <p>ID: <span className="font-mono text-gray-300">{deployment.id}</span></p>
                        <p>Environment: <span className="text-gray-300">{deployment.environment}</span></p>
                        <p>Status: 
                           <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider
                               ${deployment.status === 'SUCCESS' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 
                                 deployment.status === 'FAILED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                                 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                               {deployment.status}
                           </span>
                        </p>
                        {deployment.durationMs && (
                            <p>Duration: <span className="text-gray-300">{(deployment.durationMs / 1000).toFixed(1)}s</span></p>
                        )}
                        <p>Trigger: <span className="text-gray-300">{deployment.triggerSource}</span></p>
                    </div>
                </div>

                {/* Terminal Window */}
                <div className="w-full rounded-xl overflow-hidden border border-gray-800 bg-[#0a0e14] shadow-2xl h-[70vh] flex flex-col">
                    <div className="flex items-center gap-2 px-4 py-3 bg-[#0d1117] border-b border-gray-800 shrink-0">
                        <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                        <span className="ml-2 text-xs font-mono text-gray-500">Build Logs</span>
                        <div className="ml-auto text-xs text-gray-400">
                            {deployment.status === 'PENDING' && (
                                <span className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div> Live
                                </span>
                            )}
                        </div>
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden font-mono text-xs sm:text-sm">
                        {logs.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                                No logs to display yet.
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-800/50 py-2">
                                {logs.map((entry, idx) => (
                                    <div key={idx} className={`flex gap-4 px-6 py-1.5 hover:bg-white/[0.02] ${typeStyles[entry.type as keyof typeof typeStyles] || typeStyles.info}`}>
                                        <span className="text-gray-600 select-none shrink-0 tabular-nums w-[100px]">
                                            {entry.timestamp}
                                        </span>
                                        <span className="break-all whitespace-pre-wrap min-w-0">
                                            {entry.text}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
