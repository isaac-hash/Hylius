import { NextResponse } from 'next/server';
import { prisma } from '../../../../../services/prisma';
import { requireAuth } from '../../../../../services/auth.service';
import { GlitchtipApiService } from '../../../../../services/glitchtip-api.service';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) {
            return NextResponse.json({ error: 'Organization required' }, { status: 400 });
        }

        const { id: projectId } = await params;
        const project = await prisma.project.findFirst({
            where: {
                id: projectId,
                organizationId: auth.organizationId,
            },
            include: { server: true }
        });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        if (!project.server || !project.server.hasErrorTracking) {
            return NextResponse.json({ error: 'Error Tracking is not installed on this server' }, { status: 400 });
        }

        const issues = await GlitchtipApiService.getIssues(projectId);
        return NextResponse.json(issues);

    } catch (error: any) {
        console.error('[Errors API]', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
