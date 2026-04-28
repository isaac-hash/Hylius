import { NextResponse } from 'next/server';
import { prisma } from '../../../../services/prisma';
import { AlertService } from '../../../../services/alert.service';

// This endpoint should be hit every minute by a cron job
// e.g. curl -X POST http://localhost:3000/api/cron/check-servers
export async function POST(request: Request) {
    try {
        // Optional: Add simple secret verification here for production
        // const authHeader = request.headers.get('authorization');
        // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        //     return new Response('Unauthorized', { status: 401 });
        // }

        const thresholdDate = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

        // Find servers that have connectionMode = 'AGENT', are currently 'ONLINE',
        // but haven't sent a heartbeat in the last 5 minutes.
        const offlineServers = await prisma.server.findMany({
            where: {
                connectionMode: 'AGENT',
                status: 'ONLINE',
                lastHeartbeatAt: {
                    lt: thresholdDate
                }
            }
        });

        if (offlineServers.length === 0) {
            return NextResponse.json({ success: true, message: 'No newly offline servers found' });
        }

        console.log(`[Cron] Found ${offlineServers.length} offline servers`);

        for (const server of offlineServers) {
            // Mark as offline
            await prisma.server.update({
                where: { id: server.id },
                data: { status: 'OFFLINE' }
            });

            // Trigger alert
            await AlertService.triggerAlert({
                organizationId: server.organizationId,
                type: 'SERVER_OFFLINE',
                message: `Server **${server.name}** (${server.ip}) has gone offline. We haven't received a heartbeat in over 5 minutes.`,
                serverId: server.id,
            });
        }

        return NextResponse.json({ success: true, updatedCount: offlineServers.length });

    } catch (error: any) {
        console.error('[Cron Error] Failed to check offline servers:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
