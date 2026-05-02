import { NextResponse } from 'next/server';
import { prisma } from '../../../../services/prisma';
import { requireAuth } from '../../../../services/auth.service';
import { runPageSpeedAudit } from '../../../../services/pagespeed.service';

// GET /api/analytics/performance?projectId=X  — fetch audit history
// GET /api/analytics/performance               — fetch latest per project (overview)
export async function GET(request: Request) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });

        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (projectId) {
            // Verify project ownership
            const project = await prisma.project.findFirst({
                where: { id: projectId, organizationId: auth.organizationId },
                select: { id: true, name: true },
            });
            if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

            // @ts-ignore
            const audits = await prisma.performanceAudit.findMany({
                where: { projectId },
                orderBy: { createdAt: 'asc' },
                take: 50,
            });
            return NextResponse.json({ project, audits });
        }

        // Overview: latest audit per project
        const projects = await prisma.project.findMany({
            where: { organizationId: auth.organizationId },
            select: { id: true, name: true, domains: { select: { hostname: true }, take: 1 } },
            orderBy: { createdAt: 'desc' },
        });

        const overview = await Promise.all(
            projects.map(async (p) => {
                // @ts-ignore
                const latest = await prisma.performanceAudit.findFirst({
                    where: { projectId: p.id },
                    orderBy: { createdAt: 'desc' },
                });
                return { project: p, latestAudit: latest ?? null };
            })
        );

        return NextResponse.json(overview);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') return NextResponse.json({ error: message }, { status: 401 });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// POST /api/analytics/performance — trigger a new audit
export async function POST(request: Request) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });

        const body = await request.json();
        const { projectId, url } = body;

        if (!projectId || !url) {
            return NextResponse.json({ error: 'projectId and url are required' }, { status: 400 });
        }

        const project = await prisma.project.findFirst({
            where: { id: projectId, organizationId: auth.organizationId },
        });
        if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

        const result = await runPageSpeedAudit(projectId, url);
        return NextResponse.json({ success: true, result });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') return NextResponse.json({ error: message }, { status: 401 });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
