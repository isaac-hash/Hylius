import { NextResponse } from 'next/server';
import { prisma } from '../../../../services/prisma';
import { AlertService } from '../../../../services/alert.service';

// This endpoint is hit every minute by the VPS cron:
//   * * * * * curl -s -X POST http://localhost:3000/api/cron/check-servers
export async function POST(request: Request) {
    try {
        const now = new Date();

        // ─── 1. Detect offline agents (runs every minute) ─────────────────────────
        const thresholdDate = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago

        const offlineServers = await prisma.server.findMany({
            where: {
                connectionMode: 'AGENT',
                status: 'ONLINE',
                lastHeartbeatAt: { lt: thresholdDate },
            },
        });

        for (const server of offlineServers) {
            await prisma.server.update({
                where: { id: server.id },
                data: { status: 'OFFLINE' },
            });
            await AlertService.triggerAlert({
                organizationId: server.organizationId,
                type: 'SERVER_OFFLINE',
                message: `Server **${server.name}** (${server.ip}) has gone offline. No heartbeat in over 5 minutes.`,
                serverId: server.id,
            });
        }

        if (offlineServers.length > 0) {
            console.log(`[Cron] Marked ${offlineServers.length} server(s) offline`);
        }

        // ─── 2. Metrics downsampling — runs once per hour (at minute :00) ────────
        // Condenses minute-level snapshots that are 24h–31d old into 1-per-hour
        // averages, keeping chart data available for 7d/30d ranges without
        // unbounded storage growth.
        if (now.getMinutes() === 0) {
            await downsampleMetrics();
        }

        // ─── 3. Long-term pruning — runs daily at 03:00 ───────────────────────────
        // Removes any remaining snapshots older than 30 days.
        if (now.getHours() === 3 && now.getMinutes() === 0) {
            const pruneDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const { count } = await prisma.metric.deleteMany({
                where: { createdAt: { lt: pruneDate } },
            });
            if (count > 0) {
                console.log(`[Cron] Pruned ${count} metric snapshots older than 30 days`);
            }
        }

        return NextResponse.json({
            success: true,
            offlineDetected: offlineServers.length,
            timestamp: now.toISOString(),
        });

    } catch (error: any) {
        console.error('[Cron Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * For each server, take all Metric rows between 25h and 31d ago that have
 * minute-level granularity (more than 1 row per hour), compute an hourly
 * average, insert one representative row, and delete the originals.
 *
 * This keeps chart data usable for 7d/30d time ranges while capping storage.
 */
async function downsampleMetrics() {
    const windowEnd   = new Date(Date.now() - 25 * 60 * 60 * 1000);   // 25h ago
    const windowStart = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000); // 31d ago

    const servers = await prisma.server.findMany({ select: { id: true } });

    for (const { id: serverId } of servers) {
        const rows = await prisma.metric.findMany({
            where: { serverId, createdAt: { gte: windowStart, lte: windowEnd } },
            orderBy: { createdAt: 'asc' },
            select: { id: true, cpu: true, memory: true, disk: true, uptime: true, createdAt: true },
        });

        if (rows.length < 2) continue;

        // Group by UTC hour
        const byHour = new Map<string, typeof rows>();
        for (const row of rows) {
            const d = new Date(row.createdAt);
            const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}`;
            if (!byHour.has(key)) byHour.set(key, []);
            byHour.get(key)!.push(row);
        }

        for (const [, group] of byHour) {
            // Only process hours with multiple raw snapshots
            if (group.length <= 1) continue;

            const avg = (field: 'cpu' | 'memory' | 'disk') =>
                group.reduce((s, r) => s + r[field], 0) / group.length;

            // Representative timestamp = start of the hour
            const hourStart = new Date(group[0].createdAt);
            hourStart.setUTCMinutes(0, 0, 0);

            await prisma.$transaction([
                prisma.metric.deleteMany({ where: { id: { in: group.map(r => r.id) } } }),
                prisma.metric.create({
                    data: {
                        serverId,
                        cpu:      avg('cpu'),
                        memory:   avg('memory'),
                        disk:     avg('disk'),
                        uptime:   group[group.length - 1].uptime,
                        createdAt: hourStart,
                    },
                }),
            ]);
        }

        console.log(`[Cron/Downsample] Server ${serverId}: processed ${rows.length} snapshots into hourly aggregates`);
    }
}
