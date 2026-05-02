import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../services/prisma';
import { requireAuth } from '../../../../../../services/auth.service';
import {
    umamiGetStats,
    umamiGetPageviews,
    umamiGetMetrics,
    umamiGetActive,
    umamiLogin,
} from '../../../../../../services/umami-api.service';

function periodToRange(period: string): { startAt: number; endAt: number; unit: 'hour' | 'day' | 'month' } {
    const now = Date.now();
    switch (period) {
        case '24h': return { startAt: now - 24 * 60 * 60 * 1000, endAt: now, unit: 'hour' };
        case '7d':  return { startAt: now - 7 * 24 * 60 * 60 * 1000, endAt: now, unit: 'day' };
        case '30d': return { startAt: now - 30 * 24 * 60 * 60 * 1000, endAt: now, unit: 'day' };
        default:    return { startAt: now - 7 * 24 * 60 * 60 * 1000, endAt: now, unit: 'day' };
    }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const auth = await requireAuth(request);
        if (!auth.organizationId) {
            return NextResponse.json({ error: 'Organization required' }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period') || '7d';
        const { startAt, endAt, unit } = periodToRange(period);

        const project = await prisma.project.findFirst({
            where: { id, organizationId: auth.organizationId },
            include: { server: true },
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const siteId = (project as any).trafficAnalyticsSiteId as string | null;
        if (!siteId) {
            return NextResponse.json({ error: 'Analytics not enabled for this project' }, { status: 400 });
        }

        const server = project.server as any;
        if (!server.trafficAnalyticsUrl) {
            return NextResponse.json({ error: 'Umami is not running on this server' }, { status: 400 });
        }

        let token = server.trafficAnalyticsToken as string | null;

        // Helper that retries once with a fresh token on 401
        async function callWithRetry<T>(fn: (t: string) => Promise<T>): Promise<T> {
            if (!token) {
                token = await umamiLogin(server.trafficAnalyticsUrl, 'admin', 'umami');
                await prisma.server.update({ where: { id: server.id }, data: { trafficAnalyticsToken: token } as any });
            }
            try {
                return await fn(token!);
            } catch (err: any) {
                if (err.message?.includes('401') || err.message?.includes('403')) {
                    token = await umamiLogin(server.trafficAnalyticsUrl, 'admin', 'umami');
                    await prisma.server.update({ where: { id: server.id }, data: { trafficAnalyticsToken: token } as any });
                    return fn(token!);
                }
                throw err;
            }
        }

        // Fetch all data in parallel
        const [summary, pageviews, active, topPages, referrers, browsers, devices, countries] = await Promise.all([
            callWithRetry(t => umamiGetStats(server.trafficAnalyticsUrl, t, siteId, startAt, endAt)),
            callWithRetry(t => umamiGetPageviews(server.trafficAnalyticsUrl, t, siteId, startAt, endAt, unit)),
            callWithRetry(t => umamiGetActive(server.trafficAnalyticsUrl, t, siteId)),
            callWithRetry(t => umamiGetMetrics(server.trafficAnalyticsUrl, t, siteId, startAt, endAt, 'path', 10)),
            callWithRetry(t => umamiGetMetrics(server.trafficAnalyticsUrl, t, siteId, startAt, endAt, 'referrer', 10)),
            callWithRetry(t => umamiGetMetrics(server.trafficAnalyticsUrl, t, siteId, startAt, endAt, 'browser', 8)),
            callWithRetry(t => umamiGetMetrics(server.trafficAnalyticsUrl, t, siteId, startAt, endAt, 'device', 5)),
            callWithRetry(t => umamiGetMetrics(server.trafficAnalyticsUrl, t, siteId, startAt, endAt, 'country', 10)),
        ]);

        const avgDuration = summary.visits > 0
            ? Math.round(summary.totaltime / summary.visits)
            : 0;

        const bounceRate = summary.visits > 0
            ? Math.round((summary.bounces / summary.visits) * 100)
            : 0;

        return NextResponse.json({
            period,
            summary: {
                pageviews: summary.pageviews,
                visitors: summary.visitors,
                visits: summary.visits,
                bounceRate,
                avgDuration, // seconds
                active,
            },
            pageviews,
            topPages,
            referrers,
            browsers,
            devices,
            countries,
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') return NextResponse.json({ error: message }, { status: 401 });
        console.error('[Analytics Stats]', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
