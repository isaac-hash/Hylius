import { prisma } from './prisma';
import { agentGateway } from './agent-gateway.service';
import crypto from 'crypto';

export class GlitchtipService {
    /**
     * Deploys GlitchTip onto the target server via the Agent.
     */
    static async install(serverId: string, userId: string): Promise<void> {
        const server = await prisma.server.findUnique({ where: { id: serverId } });
        if (!server || server.connectionMode !== 'AGENT') {
            throw new Error('Server not found or not connected via agent');
        }

        // Check resources (Needs ~500MB RAM)
        const latestMetric = await prisma.metric.findFirst({
            where: { serverId },
            orderBy: { createdAt: 'desc' }
        });
        
        if (latestMetric) {
            // Rough check, assuming memory is % used. If memory > 90%, it's too full.
            if (latestMetric.memory > 90) {
                throw new Error('Server does not have enough free RAM to install Error Tracking.');
            }
        }

        // Generate credentials
        const secretKey = crypto.randomBytes(32).toString('hex');
        const adminPass = crypto.randomBytes(16).toString('hex');
        const domain = `errors-${server.ip.replace(/\./g, '-')}.nip.io`;

        // Dispatch to agent
        console.log(`[GlitchTip Service] Sending install-glitchtip command to agent for server ${serverId}...`);
        await agentGateway.sendCommand(serverId, 'install-glitchtip', {
            domain,
            secretKey,
            adminPass
        });
        console.log(`[GlitchTip Service] Command successful! Updating database for server ${serverId}...`);

        // Save to DB
        await prisma.server.update({
            where: { id: serverId },
            data: {
                hasErrorTracking: true,
                errorTrackingUrl: `https://${domain}`,
                errorTrackingToken: adminPass, // We store the admin pass to use for API calls
            }
        });
        console.log(`[GlitchTip Service] Database updated successfully for server ${serverId}.`);
    }

    /**
     * Uninstalls GlitchTip from the target server.
     */
    static async uninstall(serverId: string, userId: string): Promise<void> {
        const server = await prisma.server.findUnique({ where: { id: serverId } });
        if (!server || server.connectionMode !== 'AGENT') {
            throw new Error('Server not found or not connected via agent');
        }

        await agentGateway.sendCommand(serverId, 'uninstall-glitchtip', {});

        await prisma.server.update({
            where: { id: serverId },
            data: {
                hasErrorTracking: false,
                errorTrackingUrl: null,
                errorTrackingToken: null,
            }
        });
    }
}
