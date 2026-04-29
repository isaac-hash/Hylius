import { NextResponse } from 'next/server';
import { prisma } from '../../../../services/prisma';
import { requireAuth } from '../../../../services/auth.service';
import { deleteProject } from '../../../../services/project.service';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });

        const params = await context.params;
        const projectId = params.id;

        await deleteProject(projectId, auth.organizationId);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        if (error.message === 'Project not found') {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        return NextResponse.json({ error: error.message || 'Failed to delete project' }, { status: 500 });
    }
}
