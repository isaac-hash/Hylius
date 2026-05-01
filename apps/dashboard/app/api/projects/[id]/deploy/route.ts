import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../services/auth.service';
import { executeDeployment } from '../../../../../services/deploy.service';
import { prisma } from '../../../../../services/prisma';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });

        const params = await context.params;
        const projectId = params.id;

        // Verify project exists and belongs to org
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { organizationId: true }
        });

        if (!project || project.organizationId !== auth.organizationId) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Trigger background deployment
        executeDeployment({ projectId, trigger: 'dashboard' }).catch((err: any) => {
            console.error(`Background deployment failed for ${projectId}:`, err);
        });

        return NextResponse.json({ success: true, message: 'Deployment triggered' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed to trigger deployment' }, { status: 500 });
    }
}
