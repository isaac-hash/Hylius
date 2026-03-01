/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { getSocket } from '../services/socket';

interface DeploymentTerminalProps {
    projectId: string;
    /** When true, the terminal is visible and socket listeners are active. */
    active: boolean;
    /** Called when deployment completes (success or failure). */
    onDeployFinished?: () => void;
}

export default function DeploymentTerminal({ projectId, active, onDeployFinished }: DeploymentTerminalProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const hasTriggered = useRef(false);
    const onDeployFinishedRef = useRef(onDeployFinished);

    useEffect(() => {
        onDeployFinishedRef.current = onDeployFinished;
    }, [onDeployFinished]);

    const triggerDeploy = useCallback(() => {
        if (hasTriggered.current) return;
        hasTriggered.current = true;

        const socket = getSocket();
        const term = xtermRef.current;

        if (term) {
            term.writeln('\x1b[33mConnecting to deployment server...\x1b[0m');
        }

        socket.emit('deploy', { projectId });
    }, [projectId]);

    useEffect(() => {
        if (!active || !terminalRef.current) return;

        // Avoid double-init
        if (xtermRef.current) {
            triggerDeploy();
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

        socket.on(`log:${projectId}`, (data: string) => {
            term.write(data);
        });

        socket.on(`deploy_start:${projectId}`, (data: { deploymentId: string }) => {
            term.writeln(`\x1b[36mDeployment ID: ${data.deploymentId}\x1b[0m`);
        });

        socket.on(`deploy_success:${projectId}`, (result: any) => {
            term.writeln(`\n\x1b[32m✓ Deployment completed in ${result.durationMs}ms\x1b[0m`);
            onDeployFinishedRef.current?.();
        });

        socket.on(`deploy_error:${projectId}`, (error: string) => {
            term.writeln(`\n\x1b[31m✗ Deployment failed: ${error}\x1b[0m`);
            onDeployFinishedRef.current?.();
        });

        socket.on(`error:${projectId}`, (err: string) => {
            term.writeln(`\n\x1b[31mError: ${err}\x1b[0m`);
        });

        // Handle resize
        const handleResize = () => fitAddon.fit();
        window.addEventListener('resize', handleResize);

        // Trigger deploy
        triggerDeploy();

        return () => {
            socket.off(`log:${projectId}`);
            socket.off(`deploy_start:${projectId}`);
            socket.off(`deploy_success:${projectId}`);
            socket.off(`deploy_error:${projectId}`);
            socket.off(`error:${projectId}`);
            window.removeEventListener('resize', handleResize);
            term.dispose();
            xtermRef.current = null;
            hasTriggered.current = false;
        };
    }, [active, projectId, triggerDeploy]);

    if (!active) return null;

    return (
        <div className="w-full h-[400px] bg-[#0d1117] rounded-lg overflow-hidden border border-gray-800">
            <div className="flex items-center gap-1.5 px-4 py-2 bg-[#161b22] border-b border-gray-800">
                <span className="w-3 h-3 rounded-full bg-red-500/80"></span>
                <span className="w-3 h-3 rounded-full bg-yellow-500/80"></span>
                <span className="w-3 h-3 rounded-full bg-green-500/80"></span>
                <span className="text-gray-500 text-xs ml-2 font-mono">deployment log</span>
            </div>
            <div ref={terminalRef} className="w-full h-[calc(100%-36px)] p-1" />
        </div>
    );
}
