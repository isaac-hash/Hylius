/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { getSocket } from '../services/socket';

interface LogEntry {
    timestamp: string;
    text: string;
    type: 'info' | 'warn' | 'error' | 'command' | 'success';
}

interface DeploymentTerminalProps {
    projectId: string;
    projectName?: string;
    branch?: string;
    /** When true, the terminal is visible and socket listeners are active. */
    active: boolean;
    /** Called when deployment completes (success or failure). */
    onDeployFinished?: () => void;
    /** Called when the user clicks the close button. */
    onClose?: () => void;
}

/** Strip ANSI escape codes and determine the log entry type. */
function parseLogLine(raw: string): { text: string; type: LogEntry['type'] } {
    // Detect type from ANSI codes before stripping
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

    // Strip all ANSI escape sequences
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

type DeployStatus = 'deploying' | 'success' | 'failed';

export default function DeploymentTerminal({
    projectId,
    projectName,
    branch,
    active,
    onDeployFinished,
    onClose,
}: DeploymentTerminalProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [status, setStatus] = useState<DeployStatus>('deploying');
    const [firewallWarning, setFirewallWarning] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const hasTriggered = useRef(false);
    const onDeployFinishedRef = useRef(onDeployFinished);

    useEffect(() => {
        onDeployFinishedRef.current = onDeployFinished;
    }, [onDeployFinished]);

    // Auto-scroll on new log entries
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const addLog = useCallback((raw: string, forceType?: LogEntry['type']) => {
        // Split multi-line data into individual log entries
        const lines = raw.split('\n').filter((l) => l.trim() !== '');
        const entries: LogEntry[] = lines.map((line) => {
            const { text, type } = parseLogLine(line);

            // Detect firewall warning marker from core deploy log
            const fwMatch = text.match(/\[FIREWALL_WARNING\]\s*port=(\d+)/);
            if (fwMatch) {
                setFirewallWarning(fwMatch[1]);
            }

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

    const triggerDeploy = useCallback(() => {
        if (hasTriggered.current) return;
        hasTriggered.current = true;

        addLog('Connecting to deployment server...', 'warn');

        const socket = getSocket();
        socket.emit('deploy', { projectId });
    }, [projectId, addLog]);

    useEffect(() => {
        if (!active) return;

        // Trigger deploy
        triggerDeploy();

        // Socket listeners
        const socket = getSocket();

        socket.on(`log:${projectId}`, (data: string) => {
            addLog(data);
        });

        socket.on(`deploy_start:${projectId}`, (data: { deploymentId: string }) => {
            addLog(`Deployment ID: ${data.deploymentId}`, 'command');
        });

        socket.on(`deploy_success:${projectId}`, (result: any) => {
            addLog(`✓ Deployment completed in ${result.durationMs}ms`, 'success');
            setStatus('success');
            onDeployFinishedRef.current?.();
        });

        socket.on(`deploy_error:${projectId}`, (error: string) => {
            addLog(`✗ Deployment failed: ${error}`, 'error');
            setStatus('failed');
            onDeployFinishedRef.current?.();
        });

        socket.on(`error:${projectId}`, (err: string) => {
            addLog(`Error: ${err}`, 'error');
        });

        return () => {
            socket.off(`log:${projectId}`);
            socket.off(`deploy_start:${projectId}`);
            socket.off(`deploy_success:${projectId}`);
            socket.off(`deploy_error:${projectId}`);
            socket.off(`error:${projectId}`);
            hasTriggered.current = false;
        };
    }, [active, projectId, triggerDeploy, addLog]);

    if (!active) return null;

    const statusConfig: Record<DeployStatus, { label: string; bg: string; text: string; dot: string }> = {
        deploying: {
            label: 'Deploying',
            bg: 'bg-amber-500/15 border-amber-500/30',
            text: 'text-amber-400',
            dot: 'bg-amber-400 animate-pulse',
        },
        success: {
            label: 'Success',
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
        <div className="w-full rounded-xl overflow-hidden border border-gray-800 bg-[#0a0e14] shadow-2xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 bg-[#0d1117] border-b border-gray-800">
                <div className="min-w-0">
                    <h3 className="text-white font-bold text-base sm:text-lg truncate">
                        {projectName || 'Deployment'}
                    </h3>
                    {branch && (
                        <p className="text-gray-500 text-xs sm:text-sm mt-0.5 font-mono truncate">
                            {branch} branch
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <span
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${s.bg} ${s.text}`}
                    >
                        <span className={`w-2 h-2 rounded-full ${s.dot}`}></span>
                        {s.label}
                    </span>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-300 transition-colors text-xs sm:text-sm"
                        >
                            Close Terminal
                        </button>
                    )}
                </div>
            </div>

            {/* Log Area */}
            <div
                ref={scrollRef}
                className="overflow-y-auto overflow-x-hidden font-mono text-xs sm:text-sm"
                style={{ maxHeight: '400px' }}
            >
                {logs.length === 0 ? (
                    <div className="flex items-center justify-center py-12 text-gray-600 text-sm">
                        <svg className="animate-spin h-4 w-4 mr-2 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Waiting for deployment logs...
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

            {/* Firewall Warning Banner */}
            {firewallWarning && (
                <div className="px-4 sm:px-6 py-3 bg-amber-500/10 border-t border-amber-500/30 flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div className="min-w-0">
                        <p className="text-amber-300 text-sm font-semibold">Cloud Firewall Notice</p>
                        <p className="text-amber-200/70 text-xs mt-1 leading-relaxed">
                            Your app is running on port <span className="font-mono font-bold text-amber-300">{firewallWarning}</span>, but your VPS provider&apos;s cloud firewall may be blocking external access.
                            Open your provider&apos;s firewall dashboard and allow <span className="font-mono font-bold text-amber-300">TCP port {firewallWarning}</span>.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
