/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { getSocket } from '../services/socket';

interface LogEntry {
    timestamp: string;
    text: string;
    type: 'info' | 'warn' | 'error' | 'stdout' | 'stderr';
}

interface ProjectLogsTerminalProps {
    projectId: string;
    projectName?: string;
    /** When true, the terminal is mounted and streaming is active. */
    active: boolean;
    /** Called when the user clicks the close button. */
    onClose?: () => void;
}

function parseLogLine(raw: string): { text: string; type: LogEntry['type'] } {
    const lower = raw.toLowerCase();
    let type: LogEntry['type'] = 'stdout';

    if (raw.includes('\x1b[31m') || lower.includes('error') || lower.includes('fatal') || lower.includes('exception')) {
        type = 'error';
    } else if (raw.includes('\x1b[33m') || lower.includes('warn')) {
        type = 'warn';
    } else if (raw.includes('\x1b[32m') || lower.includes('info') || lower.includes('ready') || lower.includes('started')) {
        type = 'info';
    }

    // Strip ANSI escape codes
    const text = raw.replace(/\x1b\[[0-9;]*m/g, '').replace(/\r/g, '').trimEnd();
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

const MAX_LINES = 500;

export default function ProjectLogsTerminal({
    projectId,
    projectName,
    active,
    onClose,
}: ProjectLogsTerminalProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('');
    const [autoScroll, setAutoScroll] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const isWatchingRef = useRef(false);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);
    const usedSocketRef = useRef(false);

    const addLog = useCallback((raw: string, forceType?: LogEntry['type']) => {
        const lines = raw.split('\n').filter(l => l.trim() !== '');
        const entries: LogEntry[] = lines.map(line => {
            const { text, type } = parseLogLine(line);
            return { timestamp: formatTimestamp(), text, type: forceType ?? type };
        });
        if (entries.length > 0) {
            setLogs(prev => [...prev, ...entries].slice(-MAX_LINES));
        }
    }, []);

    // Auto-scroll when new logs arrive
    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    // Detect manual scroll-up to pause auto-scroll
    const handleScroll = useCallback(() => {
        if (!scrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
        setAutoScroll(isAtBottom);
    }, []);

    // START polling fallback
    const startPolling = useCallback(() => {
        if (pollIntervalRef.current) return;
        addLog('⟳ Polling logs every 3 seconds...', 'info');

        const poll = async () => {
            try {
                const res = await fetch(`/api/projects/${projectId}/logs`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (data.lines && Array.isArray(data.lines)) {
                    // Replace all logs with the latest snapshot
                    const entries: LogEntry[] = data.lines
                        .filter((l: string) => l.trim() !== '')
                        .map((line: string) => {
                            const { text, type } = parseLogLine(line);
                            return { timestamp: formatTimestamp(), text, type };
                        });
                    setLogs(entries.slice(-MAX_LINES));
                }
            } catch (e: any) {
                // silent - don't spam error on poll failure
            }
        };

        poll(); // immediate first fetch
        pollIntervalRef.current = setInterval(poll, 3000);
    }, [projectId, addLog]);

    const stopPolling = useCallback(() => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    }, []);

    // MAIN: connect via Socket.io, fall back to polling if socket doesn't confirm
    useEffect(() => {
        if (!active) return;
        if (isWatchingRef.current) return;
        isWatchingRef.current = true;

        setLogs([]);
        setError('');
        setConnected(false);

        const socket = getSocket();
        socketRef.current = socket;

        // Give socket 4 seconds to connect and confirm — otherwise fall back to polling
        const fallbackTimer = setTimeout(() => {
            if (!usedSocketRef.current) {
                addLog('⚠ Real-time stream unavailable, falling back to polling...', 'warn');
                startPolling();
            }
        }, 4000);

        socket.emit('watch-logs', { projectId });

        socket.on(`logs:connected:${projectId}`, () => {
            usedSocketRef.current = true;
            clearTimeout(fallbackTimer);
            stopPolling();
            setConnected(true);
            setError('');
            addLog('✓ Connected — streaming live logs', 'info');
        });

        socket.on(`logs:data:${projectId}`, (chunk: string) => {
            usedSocketRef.current = true;
            addLog(chunk);
        });

        socket.on(`logs:error:${projectId}`, (msg: string) => {
            setError(msg);
            setConnected(false);
            addLog(`✗ Stream error: ${msg} — switching to polling`, 'error');
            startPolling();
        });

        socket.on(`logs:closed:${projectId}`, () => {
            setConnected(false);
            addLog('Stream closed. Switching to polling...', 'warn');
            startPolling();
        });

        return () => {
            clearTimeout(fallbackTimer);
            socket.emit('unwatch-logs', { projectId });
            socket.off(`logs:connected:${projectId}`);
            socket.off(`logs:data:${projectId}`);
            socket.off(`logs:error:${projectId}`);
            socket.off(`logs:closed:${projectId}`);
            stopPolling();
            isWatchingRef.current = false;
            usedSocketRef.current = false;
            socketRef.current = null;
        };
    }, [active, projectId]);

    if (!active) return null;

    const typeStyles: Record<LogEntry['type'], string> = {
        info: 'text-cyan-400',
        warn: 'text-amber-300',
        error: 'text-red-400',
        stdout: 'text-gray-300',
        stderr: 'text-orange-400',
    };

    const filteredLogs = filter
        ? logs.filter(l => l.text.toLowerCase().includes(filter.toLowerCase()))
        : logs;

    const isPolling = pollIntervalRef.current !== null;

    return (
        <div className="w-full rounded-xl overflow-hidden border border-gray-800 bg-[#0a0e14] shadow-2xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3 bg-[#0d1117] border-b border-gray-800">
                <div className="flex items-center gap-3 min-w-0">
                    {/* Terminal icon */}
                    <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div className="min-w-0">
                        <h3 className="text-white font-semibold text-sm truncate">
                            {projectName || 'Project'} — Live Logs
                        </h3>
                        <p className="text-gray-500 text-xs font-mono mt-0.5">
                            {connected
                                ? '● Streaming via WebSocket'
                                : isPolling
                                    ? '⟳ Polling every 3s'
                                    : '○ Connecting...'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {/* Status badge */}
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        connected
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : isPolling
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                    }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                            connected ? 'bg-green-400 animate-pulse' :
                            isPolling ? 'bg-amber-400 animate-pulse' : 'bg-gray-500'
                        }`} />
                        {connected ? 'Live' : isPolling ? 'Polling' : 'Connecting'}
                    </span>

                    {/* Filter input */}
                    <input
                        type="text"
                        placeholder="Filter..."
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        className="bg-gray-800 border border-gray-700 text-gray-300 text-xs px-2.5 py-1.5 rounded-md outline-none focus:border-gray-600 w-28 font-mono placeholder:text-gray-600"
                    />

                    {/* Clear button */}
                    <button
                        onClick={() => setLogs([])}
                        className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded hover:bg-gray-800"
                        title="Clear logs"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>

                    {/* Close button */}
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-300 transition-colors text-xs px-2 py-1 rounded hover:bg-gray-800"
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>

            {/* Error banner */}
            {error && (
                <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs font-mono">
                    {error}
                </div>
            )}

            {/* Log Area */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="overflow-y-auto overflow-x-hidden font-mono text-xs"
                style={{ height: '320px' }}
            >
                {filteredLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-2">
                        <svg className="animate-spin h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span className="text-xs">{filter ? 'No lines match filter' : 'Waiting for log output...'}</span>
                    </div>
                ) : (
                    <div>
                        {filteredLogs.map((entry, idx) => (
                            <div
                                key={idx}
                                className={`flex gap-3 px-4 py-0.5 hover:bg-white/[0.02] transition-colors ${typeStyles[entry.type]}`}
                            >
                                <span className="text-gray-600 select-none shrink-0 tabular-nums w-[84px]">
                                    {entry.timestamp}
                                </span>
                                <span className="break-all whitespace-pre-wrap min-w-0 leading-5">
                                    {entry.text}
                                </span>
                            </div>
                        ))}
                        {/* Auto-scroll anchor */}
                        <div className="h-1" />
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#0d1117] border-t border-gray-800">
                <span className="text-gray-600 text-xs font-mono">
                    {filteredLogs.length} line{filteredLogs.length !== 1 ? 's' : ''}
                    {filter && ` (filtered from ${logs.length})`}
                    {logs.length >= MAX_LINES && ` · capped at ${MAX_LINES}`}
                </span>
                {!autoScroll && (
                    <button
                        onClick={() => {
                            setAutoScroll(true);
                            if (scrollRef.current) {
                                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                            }
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                    >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                        Scroll to bottom
                    </button>
                )}
            </div>
        </div>
    );
}
