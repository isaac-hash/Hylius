import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../services/prisma';
import { requireAuth } from '../../../../../../services/auth.service';
import { umamiDeleteWebsite } from '../../../../../../services/umami-api.service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const auth = await requireAuth(request);
        if (!auth.organizationId) {
            return NextResponse.json({ error: 'Organization required' }, { status: 400 });
        }

        const project = await prisma.project.findFirst({
            where: { id, organizationId: auth.organizationId },
            include: { server: true },
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const siteId = (project as any).trafficAnalyticsSiteId as string | null;
        if (!siteId) {
            return NextResponse.json({ error: 'Analytics is not enabled for this project' }, { status: 409 });
        }

        const server = project.server as any;

        // Remove website from Umami (best-effort — don't fail if Umami is unreachable)
        if (server.trafficAnalyticsUrl && server.trafficAnalyticsToken) {
            try {
                await umamiDeleteWebsite(server.trafficAnalyticsUrl, server.trafficAnalyticsToken, siteId);
            } catch (e: any) {
                console.warn(`[Analytics Disable] Could not delete Umami website ${siteId}: ${e.message}`);
            }
        }

        // Clear siteId from project
        await prisma.project.update({
            where: { id: project.id },
            data: { trafficAnalyticsSiteId: null } as any,
        });

        await prisma.auditLog.create({
            data: {
                action: 'ANALYTICS_DISABLED',
                organizationId: auth.organizationId,
                userId: auth.userId,
                metadata: JSON.stringify({ projectId: project.id, siteId }),
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Analytics disabled. Historical data removed from Umami.',
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') return NextResponse.json({ error: message }, { status: 401 });
        console.error('[Analytics Disable]', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
