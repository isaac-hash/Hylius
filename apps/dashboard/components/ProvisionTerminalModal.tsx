/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { getSocket } from '../services/socket';

interface LogEntry {
    timestamp: string;
    text: string;
    type: 'info' | 'warn' | 'error' | 'command' | 'success';
}

interface ProvisionTerminalModalProps {
    isOpen: boolean;
    onClose: () => void;
    serverId: string;
    serverName: string;
}

/** Strip ANSI escape codes and determine the log entry type. */
function parseLogLine(raw: string): { text: string; type: LogEntry['type'] } {
    let type: LogEntry['type'] = 'info';

    if (raw.includes('\x1b[33m') || raw.includes('\x1b[1;33m')) {
        type = 'warn';
    } else if (raw.includes('\x1b[31m')) {
        type = 'error';
    } else if (raw.includes('\x1b[36m')) {
        type = 'command';
    } else if (raw.includes('\x1b[32m')) {
        type = 'success';
    }

    const text = raw.replace(/\x1b\[[0-9;]*m/g, '').replace(/\r/g, '');
    return { text, type };
}

function formatTimestamp(): string {
    const now = new Date();
    return now.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
    });
}

type ProvisionStatus = 'provisioning' | 'success' | 'failed';

export default function ProvisionTerminalModal({ isOpen, onClose, serverId, serverName }: ProvisionTerminalModalProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [status, setStatus] = useState<ProvisionStatus>('provisioning');
    const scrollRef = useRef<HTMLDivElement>(null);
    const hasTriggered = useRef(false);

    // Auto-scroll on new log entries
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const addLog = useCallback((raw: string, forceType?: LogEntry['type']) => {
        const lines = raw.split('\n').filter((l) => l.trim() !== '');
        const entries: LogEntry[] = lines.map((line) => {
            const { text, type } = parseLogLine(line);
            return {
                timestamp: formatTimestamp(),
                text,
                type: forceType ?? type,
            };
        });
        if (entries.length > 0) {
            setLogs((prev) => [...prev, ...entries]);
        }
    }, []);

    const triggerSetup = useCallback(() => {
        if (hasTriggered.current) return;
        hasTriggered.current = true;

        addLog('Initializing secure connection to server...', 'warn');

        const socket = getSocket();
        socket.emit('setup-server', { serverId });
    }, [serverId, addLog]);

    useEffect(() => {
        if (!isOpen) return;

        // Socket listeners
        const socket = getSocket();

        socket.on('log', (data: string) => {
            addLog(data);
        });

        socket.on('setup_start', (data: { serverId: string }) => {
            addLog(`Provisioning started for Server: ${data.serverId}`, 'command');
        });

        socket.on('setup_success', (result: any) => {
            addLog(`✓ Provisioning completed in ${result.durationMs}ms`, 'success');
            setStatus('success');
        });

        socket.on('setup_error', (error: string) => {
            addLog(`✗ Provisioning failed: ${error}`, 'error');
            setStatus('failed');
        });

        socket.on('error', (err: string) => {
            addLog(`System Error: ${err}`, 'error');
            setStatus('failed');
        });

        // Delay to allow render before triggering
        setTimeout(() => triggerSetup(), 500);

        return () => {
            socket.off('log');
            socket.off('setup_start');
            socket.off('setup_success');
            socket.off('setup_error');
            socket.off('error');
            hasTriggered.current = false;
        };
    }, [isOpen, serverId, triggerSetup, addLog]);

    if (!isOpen) return null;

    const isProcessing = status === 'provisioning';

    const statusConfig: Record<ProvisionStatus, { label: string; bg: string; text: string; dot: string }> = {
        provisioning: {
            label: 'Provisioning',
            bg: 'bg-blue-500/15 border-blue-500/30',
            text: 'text-blue-400',
            dot: 'bg-blue-400 animate-pulse',
        },
        success: {
            label: 'Complete',
            bg: 'bg-green-500/15 border-green-500/30',
            text: 'text-green-400',
            dot: 'bg-green-400',
        },
        failed: {
            label: 'Failed',
            bg: 'bg-red-500/15 border-red-500/30',
            text: 'text-red-400',
            dot: 'bg-red-400',
        },
    };

    const s = statusConfig[status];

    const typeStyles: Record<LogEntry['type'], string> = {
        info: 'text-gray-300',
        warn: 'text-amber-300 bg-amber-500/8',
        error: 'text-red-400',
        command: 'text-cyan-400',
        success: 'text-green-400',
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-[#0a0e14] border border-gray-800 rounded-xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 bg-[#0d1117] border-b border-gray-800">
                    <div className="min-w-0">
                        <h2 className="text-white font-bold text-base sm:text-xl flex items-center gap-2 truncate">
                            <svg className="w-5 h-5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                            </svg>
                            <span className="truncate">{serverName}</span>
                        </h2>
                        <p className="text-gray-500 text-xs sm:text-sm mt-0.5 ml-7">
                            Installing Docker, Git, and UFW
                        </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${s.bg} ${s.text}`}>
                            <span className={`w-2 h-2 rounded-full ${s.dot}`}></span>
                            {s.label}
                        </span>
                        {!isProcessing && (
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-white transition-colors bg-gray-800 hover:bg-gray-700 p-2 rounded-full"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* Log Area */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto overflow-x-hidden font-mono text-xs sm:text-sm"
                    style={{ minHeight: '300px' }}
                >
                    {logs.length === 0 ? (
                        <div className="flex items-center justify-center py-16 text-gray-600 text-sm">
                            <svg className="animate-spin h-4 w-4 mr-2 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Waiting for provisioning logs...
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-800/50">
                            {logs.map((entry, idx) => (
                                <div
                                    key={idx}
                                    className={`flex gap-2 sm:gap-4 px-4 sm:px-6 py-2 hover:bg-white/[0.02] transition-colors ${typeStyles[entry.type]}`}
                                >
                                    <span className="text-gray-600 select-none shrink-0 tabular-nums w-[90px] sm:w-[100px]">
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

                {/* Footer */}
                <div className="px-4 sm:px-6 py-4 bg-[#0d1117] border-t border-gray-800 flex justify-end">
                    {isProcessing ? (
                        <div className="flex items-center gap-2 text-blue-400">
                            <svg className="animate-spin h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="text-sm font-medium">Provisioning in progress... do not close</span>
                        </div>
                    ) : (
                        <button
                            onClick={onClose}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                        >
                            Close & Continue
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
}
