/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AgentMessage {
    type: string;
    commandId?: string;
    action?: string;
    payload?: any;
    // Result fields
    data?: string;
    done?: boolean;
    error?: string;
    exitCode?: number;
    // Heartbeat / auth fields
    serverId?: string;
    token?: string;
    cpu?: number;
    memory?: number;
    disk?: number;
    uptime?: number;
    version?: string;
}

interface PendingCommand {
    onChunk?: (data: string) => void;
    onDone?: (exitCode: number, resultData?: string) => void;
    onError?: (err: string) => void;
}

interface ConnectedAgent {
    ws: WebSocket;
    serverId: string;
    version?: string;
    pendingCommands: Map<string, PendingCommand>;
}

class AgentGatewayService {
    private agents = new Map<string, ConnectedAgent>();
    private wss: WebSocketServer | null = null;

    attach(wss: WebSocketServer) {
        this.wss = wss;

        wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
            console.log('[AgentGateway] New connection from', req.socket.remoteAddress);
            let agent: ConnectedAgent | null = null;

            ws.on('message', async (raw: Buffer) => {
                let msg: AgentMessage;
                try {
                    msg = JSON.parse(raw.toString());
                } catch {
                    return;
                }

                // ─── Auth handshake ───────────────────────────────────────
                if (msg.type === 'auth') {
                    const server = await prisma.server.findFirst({
                        where: { agentToken: msg.token },
                    });
                    if (!server) {
                        console.warn('[AgentGateway] Invalid token from', req.socket.remoteAddress);
                        ws.close(4001, 'Invalid token');
                        return;
                    }

                    agent = {
                        ws,
                        serverId: server.id,
                        version: msg.version,
                        pendingCommands: new Map(),
                    };
                    this.agents.set(server.id, agent);

                    // Mark server online
                    await prisma.server.update({
                        where: { id: server.id },
                        data: {
                            status: 'ONLINE',
                            connectionMode: 'AGENT',
                            agentVersion: msg.version,
                            lastHeartbeatAt: new Date(),
                        } as any,
                    }).catch(() => {}); // silently ignore if fields don't exist yet

                    console.log(`[AgentGateway] Agent authenticated: server ${server.id} (v${msg.version})`);
                    return;
                }

                if (!agent) return; // Ignore messages before auth

                // ─── Heartbeat ────────────────────────────────────────────
                if (msg.type === 'heartbeat') {
                    await prisma.server.update({
                        where: { id: agent.serverId },
                        data: { lastHeartbeatAt: new Date(), status: 'ONLINE' } as any,
                    }).catch(() => {});

                    // Broadcast live metrics to any dashboard clients watching this server
                    const io = (global as any).io;
                    if (io) {
                        io.emit(`server_metrics:${agent.serverId}`, {
                            cpu: msg.cpu,
                            memory: msg.memory,
                            disk: msg.disk,
                            uptime: msg.uptime,
                        });
                    }
                    return;
                }

                // ─── Command results ──────────────────────────────────────
                if (!msg.commandId || !agent.pendingCommands.has(msg.commandId)) return;
                const pending = agent.pendingCommands.get(msg.commandId)!;

                if (msg.type === 'command_result' && msg.data) {
                    pending.onChunk?.(msg.data);
                } else if (msg.type === 'command_done') {
                    pending.onDone?.(msg.exitCode ?? 0, msg.data);
                    agent.pendingCommands.delete(msg.commandId);
                } else if (msg.type === 'command_error') {
                    pending.onError?.(msg.error ?? 'Unknown error');
                    agent.pendingCommands.delete(msg.commandId);
                }
            });

            ws.on('close', async () => {
                if (agent) {
                    this.agents.delete(agent.serverId);
                    await prisma.server.update({
                        where: { id: agent.serverId },
                        data: { status: 'OFFLINE' } as any,
                    }).catch(() => {});
                    console.log(`[AgentGateway] Agent disconnected: server ${agent.serverId}`);
                }
            });

            ws.on('error', (err) => {
                console.error('[AgentGateway] WebSocket error:', err.message);
            });
        });
    }

    isConnected(serverId: string): boolean {
        const agent = this.agents.get(serverId);
        return !!agent && agent.ws.readyState === WebSocket.OPEN;
    }

    /**
     * Send a command and collect a single JSON result via onDone.
     */
    sendCommand(serverId: string, action: string, payload: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const agent = this.agents.get(serverId);
            if (!agent || agent.ws.readyState !== WebSocket.OPEN) {
                return reject(new Error(`Agent for server ${serverId} is not connected`));
            }
            const commandId = `cmd_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            agent.pendingCommands.set(commandId, {
                onDone: (_code, data) => resolve(data ? JSON.parse(data) : null),
                onError: reject,
            });
            agent.ws.send(JSON.stringify({ type: 'command', commandId, action, payload }));
        });
    }

    /**
     * Send a command and stream chunks via onChunk callback.
     */
    streamCommand(
        serverId: string,
        action: string,
        payload: any,
        onChunk: (data: string) => void,
    ): Promise<{ exitCode: number; resultData?: string }> {
        return new Promise((resolve, reject) => {
            const agent = this.agents.get(serverId);
            if (!agent || agent.ws.readyState !== WebSocket.OPEN) {
                return reject(new Error(`Agent for server ${serverId} is not connected`));
            }
            const commandId = `cmd_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            agent.pendingCommands.set(commandId, {
                onChunk,
                onDone: (exitCode, resultData) => resolve({ exitCode, resultData }),
                onError: reject,
            });
            agent.ws.send(JSON.stringify({ type: 'command', commandId, action, payload }));

            // Return commandId so callers can cancel log streams
            (resolve as any).__commandId = commandId;
        });
    }

    /**
     * Cancel an active streaming command (e.g. log stream).
     */
    cancelStream(serverId: string, streamCommandId: string): void {
        if (!this.isConnected(serverId)) return;
        this.sendCommand(serverId, 'stop-stream', { streamCommandId }).catch(() => {});
    }

    /**
     * Build an AgentConfig object compatible with @hylius/core dual-mode calls.
     */
    getAgentConfig(serverId: string) {
        return {
            serverId,
            sendCommand: (action: string, payload: any) => this.sendCommand(serverId, action, payload),
            streamCommand: (action: string, payload: any, onChunk: (data: string) => void) =>
                this.streamCommand(serverId, action, payload, onChunk),
        };
    }
}

// Singleton — shared across the whole server process
export const agentGateway = new AgentGatewayService();
