import { prisma } from './prisma';
import { agentGateway } from './agent-gateway.service';
import { AlertService } from './alert.service';

export class UptimeService {
    /**
     * Sends the monitor configuration to the agent.
     */
    static async syncMonitorToAgent(serverId: string, monitor: any, containerName?: string) {
        if (!agentGateway.isConnected(serverId)) {
            console.warn(`[Uptime] Cannot sync monitor ${monitor.id} - agent offline on server ${serverId}`);
            return;
        }

        const payload = {
            id: monitor.id,
            endpoint: monitor.endpoint,
            type: monitor.type,
            interval: monitor.interval,
            autoHeal: monitor.autoHeal,
            containerName: containerName || '',
        };

        try {
            await agentGateway.sendCommand(serverId, 'start-uptime', payload);
            console.log(`[Uptime] Synced monitor ${monitor.id} to agent on server ${serverId}`);
        } catch (error) {
            console.error(`[Uptime] Failed to sync monitor ${monitor.id} to agent:`, error);
        }
    }

    /**
     * Tells the agent to stop monitoring.
     */
    static async stopMonitorOnAgent(serverId: string, monitorId: string) {
        if (!agentGateway.isConnected(serverId)) return;

        try {
            await agentGateway.sendCommand(serverId, 'stop-uptime', { id: monitorId });
        } catch (error) {
            console.error(`[Uptime] Failed to stop monitor ${monitorId} on agent:`, error);
        }
    }

    /**
     * Called when the agent reports an incident (OFFLINE) or a recovery (ONLINE).
     */
    static async handleIncident(monitorId: string, status: 'ONLINE' | 'OFFLINE', errorMsg: string, autoHealed: boolean) {
        const monitor = await prisma.uptimeMonitor.findUnique({
            where: { id: monitorId },
            include: { server: true, project: true }
        });

        if (!monitor) return;

        // Update monitor status
        await prisma.uptimeMonitor.update({
            where: { id: monitorId },
            data: { status }
        });

        if (status === 'OFFLINE') {
            // Create a new incident
            await prisma.uptimeIncident.create({
                data: {
                    monitorId,
                    status: 'ONGOING',
                    autoHealed,
                    error: errorMsg,
                }
            });

            // Trigger Alert
            const targetName = monitor.project ? monitor.project.name : monitor.endpoint;
            await AlertService.triggerAlert({
                organizationId: monitor.server.organizationId,
                type: 'SERVER_OFFLINE',
                message: `**${targetName}** is DOWN. ${errorMsg}. ${autoHealed ? '(Auto-heal triggered)' : ''}`,
                serverId: monitor.serverId,
                projectId: monitor.projectId || undefined,
            });

        } else if (status === 'ONLINE') {
            // Resolve the latest ongoing incident
            const latestIncident = await prisma.uptimeIncident.findFirst({
                where: { monitorId, status: 'ONGOING' },
                orderBy: { startedAt: 'desc' }
            });

            if (latestIncident) {
                const now = new Date();
                const duration = Math.floor((now.getTime() - latestIncident.startedAt.getTime()) / 1000);
                
                await prisma.uptimeIncident.update({
                    where: { id: latestIncident.id },
                    data: {
                        status: 'RESOLVED',
                        resolvedAt: now,
                        duration,
                    }
                });

                // Trigger Recovery Alert
                const targetName = monitor.project ? monitor.project.name : monitor.endpoint;
                await AlertService.triggerAlert({
                    organizationId: monitor.server.organizationId,
                    type: 'SERVER_OFFLINE', // Or a new 'RECOVERY' type if you had one
                    message: `**${targetName}** is back ONLINE. Downtime was ${duration} seconds.`,
                    serverId: monitor.serverId,
                    projectId: monitor.projectId || undefined,
                });
            }
        }
    }

    /**
     * Syncs all ACTIVE monitors to the agent. Usually called when an agent connects.
     */
    static async syncAllMonitorsForServer(serverId: string) {
        const monitors = await prisma.uptimeMonitor.findMany({
            where: { serverId, status: { not: 'PAUSED' } },
            include: { project: true }
        });

        for (const monitor of monitors) {
            const containerName = monitor.project?.containerName || undefined;
            await this.syncMonitorToAgent(serverId, monitor, containerName);
        }
    }
}
