import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../services/prisma';
import { requireAuth } from '../../../../../../services/auth.service';
import { umamiLogin, umamiCreateWebsite } from '../../../../../../services/umami-api.service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const auth = await requireAuth(request);
        if (!auth.organizationId) {
            return NextResponse.json({ error: 'Organization required' }, { status: 400 });
        }

        const project = await prisma.project.findFirst({
            where: { id, organizationId: auth.organizationId },
            include: { server: true, domains: true },
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const server = project.server as any;

        if (!server.hasTrafficAnalytics || !server.trafficAnalyticsUrl) {
            return NextResponse.json(
                { error: 'Traffic Analytics is not installed on this project\'s server. Install it from the Marketplace first.' },
                { status: 400 },
            );
        }

        if ((project as any).trafficAnalyticsSiteId) {
            return NextResponse.json(
                { error: 'Analytics is already enabled for this project.' },
                { status: 409 },
            );
        }

        // Get or refresh the API token
        let token = server.trafficAnalyticsToken as string | null;
        if (!token) {
            token = await umamiLogin(server.trafficAnalyticsUrl, 'admin', 'umami');
            await prisma.server.update({
                where: { id: server.id },
                data: { trafficAnalyticsToken: token } as any,
            });
        }

        // Determine the domain for this project
        const domain = project.domains[0]?.hostname
            || project.name.toLowerCase().replace(/\s+/g, '-');

        // Create website in Umami
        let siteId: string;
        try {
            siteId = await umamiCreateWebsite(
                server.trafficAnalyticsUrl,
                token,
                project.name,
                domain,
            );
        } catch (err: any) {
            // Token may have expired — try refreshing once
            if (err.message?.includes('401') || err.message?.includes('403')) {
                token = await umamiLogin(server.trafficAnalyticsUrl, 'admin', 'umami');
                await prisma.server.update({
                    where: { id: server.id },
                    data: { trafficAnalyticsToken: token } as any,
                });
                siteId = await umamiCreateWebsite(server.trafficAnalyticsUrl, token, project.name, domain);
            } else {
                throw err;
            }
        }

        // Store siteId on the project
        await prisma.project.update({
            where: { id: project.id },
            data: { trafficAnalyticsSiteId: siteId } as any,
        });

        await prisma.auditLog.create({
            data: {
                action: 'ANALYTICS_ENABLED',
                organizationId: auth.organizationId,
                userId: auth.userId,
                metadata: JSON.stringify({ projectId: project.id, siteId }),
            },
        });

        const scriptTag = `<script defer src="${server.trafficAnalyticsUrl}/script.js" data-website-id="${siteId}"></script>`;

        return NextResponse.json({
            success: true,
            siteId,
            scriptTag,
            message: 'Analytics enabled. Redeploy your project to start tracking.',
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') return NextResponse.json({ error: message }, { status: 401 });
        console.error('[Analytics Enable]', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
