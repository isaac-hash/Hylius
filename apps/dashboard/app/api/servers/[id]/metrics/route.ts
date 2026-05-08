import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../services/prisma';
import { requireAuth } from '../../../../../services/auth.service';

/**
 * GET /api/servers/[id]/metrics?range=1h|6h|24h|7d|30d
 *
 * Returns historical Metric snapshots for the server, filtered by time range.
 * Also returns computed summary stats (current, avg, peak) per metric.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) {
            return NextResponse.json({ error: 'Organization required' }, { status: 400 });
        }

        const params = await context.params;
        const id = params.id;

        // Verify server belongs to this org
        const server = await prisma.server.findFirst({
            where: { id, organizationId: auth.organizationId },
            select: { id: true },
        });
        if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 });

        // Parse time range
        const range = request.nextUrl.searchParams.get('range') ?? '24h';
        const rangeMs: Record<string, number> = {
            '1h':  1  * 60 * 60 * 1000,
            '6h':  6  * 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d':  7  * 24 * 60 * 60 * 1000,
            '30d': 30 * 24 * 60 * 60 * 1000,
        };
        const windowMs = rangeMs[range] ?? rangeMs['24h'];
        const since = new Date(Date.now() - windowMs);

        // Fetch snapshots ordered chronologically
        const snapshots = await prisma.metric.findMany({
            where: { serverId: id, createdAt: { gte: since } },
            orderBy: { createdAt: 'asc' },
            select: { cpu: true, memory: true, disk: true, uptime: true, createdAt: true },
        });

        // Thin to max 500 points (uniform sub-sampling) to keep response lean
        const maxPoints = 500;
        let points = snapshots;
        if (snapshots.length > maxPoints) {
            const step = Math.ceil(snapshots.length / maxPoints);
            points = snapshots.filter((_, i) => i % step === 0);
        }

        // Compute summary stats across the full un-thinned dataset for accuracy
        const stats = computeStats(snapshots);

        return NextResponse.json({ range, points, stats });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        console.error('[Metrics API] Failed to fetch historical metrics:', message);
        return NextResponse.json({ error: `Failed to fetch metrics: ${message}` }, { status: 500 });
    }
}

function computeStats(rows: { cpu: number; memory: number; disk: number; uptime: number }[]) {
    if (rows.length === 0) {
        return {
            cpu:    { current: 0, avg: 0, peak: 0 },
            memory: { current: 0, avg: 0, peak: 0 },
            disk:   { current: 0, avg: 0, peak: 0 },
        };
    }

    const last = rows[rows.length - 1];
    const avg = (field: 'cpu' | 'memory' | 'disk') =>
        rows.reduce((acc, r) => acc + r[field], 0) / rows.length;
    const peak = (field: 'cpu' | 'memory' | 'disk') =>
        Math.max(...rows.map((r) => r[field]));

    return {
        cpu:    { current: last.cpu,    avg: avg('cpu'),    peak: peak('cpu')    },
        memory: { current: last.memory, avg: avg('memory'), peak: peak('memory') },
        disk:   { current: last.disk,   avg: avg('disk'),   peak: peak('disk')   },
    };
}
