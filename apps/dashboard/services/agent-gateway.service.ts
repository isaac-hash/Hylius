/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { PrismaClient } from '@prisma/client';
import { AlertService } from './alert.service';
import { UptimeService } from './uptime.service';

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
    uptimeMonitors?: Record<string, string>;
}

interface PendingCommand {
    onChunk?: (data: string) => void;
    onDone?: (exitCode: number, resultData?: string) => void;
    onError?: (err: string) => void;
}

interface ConnectedAgent {
    ws: WebSocket;
    serverId: string;
    organizationId: string;
    version?: string;
}

class AgentGatewayService {
    private agents = new Map<string, ConnectedAgent>();
    private serverPendingCommands = new Map<string, Map<string, PendingCommand>>();
    private wss: WebSocketServer | null = null;

    attach(wss: WebSocketServer) {
        this.wss = wss;

        wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
            const realIp = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress;
            console.log('[AgentGateway] New connection from', realIp);
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
                        console.warn(`[AgentGateway] Invalid token from ${realIp} | serverId=${msg.serverId} | token=${(msg.token || '').slice(0, 20)}...`);
                        ws.close(4001, 'Invalid token');
                        return;
                    }

                    agent = {
                        ws,
                        serverId: server.id,
                        organizationId: server.organizationId,
                        version: msg.version,
                    };
                    this.agents.set(server.id, agent);
                    
                    if (!this.serverPendingCommands.has(server.id)) {
                        this.serverPendingCommands.set(server.id, new Map());
                    }

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

                    // Sync uptime monitors on connect
                    await UptimeService.syncAllMonitorsForServer(agent.serverId).catch(console.error);

                    console.log(`[AgentGateway] Agent authenticated: server ${server.id} (v${msg.version})`);
                    return;
                }

                if (!agent) return; // Ignore messages before auth

                // ─── Uptime Incident ──────────────────────────────────────
                if (msg.type === 'uptime_incident') {
                    const payload = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload;
                    if (payload && payload.monitorId && payload.status) {
                        await UptimeService.handleIncident(
                            payload.monitorId,
                            payload.status,
                            payload.error || '',
                            payload.autoHealed || false
                        ).catch(console.error);
                    }
                    return;
                }

                // ─── Heartbeat ────────────────────────────────────────────
                if (msg.type === 'heartbeat') {
                    await prisma.server.update({
                        where: { id: agent.serverId },
                        data: { lastHeartbeatAt: new Date(), status: 'ONLINE' } as any,
                    }).catch(() => {});

                    // Persist snapshot to Metric table for historical charts (Option A)
                    if (msg.cpu !== undefined && msg.memory !== undefined && msg.disk !== undefined) {
                        prisma.metric.create({
                            data: {
                                serverId: agent.serverId,
                                cpu: msg.cpu ?? 0,
                                memory: msg.memory ?? 0,
                                disk: msg.disk ?? 0,
                                uptime: msg.uptime ?? 0,
                            },
                        }).catch(() => {});

                        // Prune snapshots older than 24h to avoid unbounded growth.
                        // Hourly aggregates for longer history can be added in a separate cron.
                        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
                        prisma.metric.deleteMany({
                            where: { serverId: agent.serverId, createdAt: { lt: cutoff } },
                        }).catch(() => {});
                    }

                    // Sync monitor statuses from agent payload
                    if (msg.uptimeMonitors && typeof msg.uptimeMonitors === 'object') {
                        const statuses = msg.uptimeMonitors as Record<string, string>;
                        for (const [monitorId, status] of Object.entries(statuses)) {
                            (prisma as any).uptimeMonitor.update({
                                where: { id: monitorId },
                                data: { status }
                            }).catch(() => {}); // silently ignore if missing
                        }
                    }

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

                    // Trigger alerts if metrics are critically high
                    if (msg.cpu !== undefined && msg.cpu > 90) {
                        AlertService.triggerAlert({
                            organizationId: agent.organizationId,
                            type: 'HIGH_CPU',
                            message: `Server **${agent.serverId}** is experiencing high CPU usage (${msg.cpu.toFixed(1)}%).`,
                            serverId: agent.serverId,
                        });
                    }

                    if (msg.disk !== undefined && msg.disk > 90) {
                        AlertService.triggerAlert({
                            organizationId: agent.organizationId,
                            type: 'HIGH_DISK',
                            message: `Server **${agent.serverId}** is running out of disk space (${msg.disk.toFixed(1)}% full).`,
                            serverId: agent.serverId,
                        });
                    }

                    return;
                }

                // ─── Command results ──────────────────────────────────────
                if (!msg.commandId) return;
                const pendingCmds = this.serverPendingCommands.get(agent.serverId);
                if (!pendingCmds || !pendingCmds.has(msg.commandId)) return;
                
                const pending = pendingCmds.get(msg.commandId)!;

                if (msg.type === 'command_result' && msg.data) {
                    pending.onChunk?.(msg.data);
                } else if (msg.type === 'command_done') {
                    pending.onDone?.(msg.exitCode ?? 0, msg.data);
                    pendingCmds.delete(msg.commandId);
                } else if (msg.type === 'command_error') {
                    pending.onError?.(msg.error ?? 'Unknown error');
                    pendingCmds.delete(msg.commandId);
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
            let pendingCmds = this.serverPendingCommands.get(serverId);
            if (!pendingCmds) {
                pendingCmds = new Map();
                this.serverPendingCommands.set(serverId, pendingCmds);
            }
            pendingCmds.set(commandId, {
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
            let pendingCmds = this.serverPendingCommands.get(serverId);
            if (!pendingCmds) {
                pendingCmds = new Map();
                this.serverPendingCommands.set(serverId, pendingCmds);
            }
            pendingCmds.set(commandId, {
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
const globalForAgent = global as unknown as { agentGateway: AgentGatewayService };
export const agentGateway = globalForAgent.agentGateway || new AgentGatewayService();
globalForAgent.agentGateway = agentGateway;
