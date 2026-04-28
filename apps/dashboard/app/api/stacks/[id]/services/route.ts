import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../services/auth.service';
import { addProjectToStack, removeProjectFromStack } from '../../../../../services/stack.service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });

        const { id } = await params;
        const body = await request.json();
        const { projectId } = body;

        if (!projectId) {
            return NextResponse.json({ error: 'Missing required field: projectId' }, { status: 400 });
        }

        await addProjectToStack(id, projectId, auth.organizationId);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') return NextResponse.json({ error: message }, { status: 401 });
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });

        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'Missing query param: projectId' }, { status: 400 });
        }

        await removeProjectFromStack(projectId, auth.organizationId);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') return NextResponse.json({ error: message }, { status: 401 });
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
