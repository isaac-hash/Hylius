/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { getSocket } from '../services/socket';

interface ProvisionTerminalModalProps {
    isOpen: boolean;
    onClose: () => void;
    serverId: string;
    serverName: string;
}

export default function ProvisionTerminalModal({ isOpen, onClose, serverId, serverName }: ProvisionTerminalModalProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const hasTriggered = useRef(false);
    const [isProcessing, setIsProcessing] = useState(true);

    const triggerSetup = useCallback(() => {
        if (hasTriggered.current) return;
        hasTriggered.current = true;
        setIsProcessing(true);

        const socket = getSocket();
        const term = xtermRef.current;

        if (term) {
            term.writeln('\x1b[33mInitializing secure connection to server...\x1b[0m');
        }

        socket.emit('setup-server', { serverId });
    }, [serverId]);

    useEffect(() => {
        if (!isOpen || !terminalRef.current) return;

        // Avoid double-init
        if (xtermRef.current) {
            return;
        }

        const term = new Terminal({
            cursorBlink: true,
            theme: {
                background: '#0d1117',
                foreground: '#c9d1d9',
                cursor: '#58a6ff',
            },
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            fontSize: 14,
            scrollback: 5000,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);
        fitAddon.fit();
        xtermRef.current = term;

        // Socket listeners
        const socket = getSocket();

        socket.on('log', (data: string) => {
            term.write(data);
        });

        socket.on('setup_start', (data: { serverId: string }) => {
            term.writeln(`\x1b[36mProvisioning started for Server: ${data.serverId}\x1b[0m\n`);
        });

        socket.on('setup_success', (result: any) => {
            term.writeln(`\n\x1b[32m\x1b[1m✓ Provisioning completed in ${result.durationMs}ms\x1b[0m\x1b[0m`);
            setIsProcessing(false);
        });

        socket.on('setup_error', (error: string) => {
            term.writeln(`\n\x1b[31m✗ Provisioning failed: ${error}\x1b[0m`);
            setIsProcessing(false);
        });

        socket.on('error', (err: string) => {
            term.writeln(`\n\x1b[31mSystem Error: ${err}\x1b[0m`);
            setIsProcessing(false);
        });

        // Handle resize
        const handleResize = () => fitAddon.fit();
        window.addEventListener('resize', handleResize);

        // Map setTimeout to allow terminal to render properly before emitting
        setTimeout(() => triggerSetup(), 500);

        return () => {
            socket.off('log');
            socket.off('setup_start');
            socket.off('setup_success');
            socket.off('setup_error');
            socket.off('error');
            window.removeEventListener('resize', handleResize);
            term.dispose();
            xtermRef.current = null;
            hasTriggered.current = false;
        };
    }, [isOpen, serverId, triggerSetup]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col h-[80vh]">

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-gray-950">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                            </svg>
                            Provisioning: <span className="text-blue-400">{serverName}</span>
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">Installing Docker, Git, and UFW.</p>
                    </div>
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

                {/* Terminal Body */}
                <div className="flex-1 w-full bg-[#0d1117] relative">
                    <div ref={terminalRef} className="absolute inset-0 p-4" />
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-gray-950 border-t border-gray-800 flex justify-end">
                    {isProcessing ? (
                        <div className="flex items-center gap-2 text-blue-400">
                            <svg className="animate-spin h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="text-sm font-medium">Provisioning in progress... do not close</span>
                        </div>
                    ) : (
                        <button
                            onClick={onClose}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-md font-medium transition-colors"
                        >
                            Close & Continue
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
}
