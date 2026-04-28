import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../services/auth.service';
import { getStack, updateStack, deleteStack } from '../../../../services/stack.service';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });

        const { id } = await params;
        const stack = await getStack(id, auth.organizationId);
        return NextResponse.json(stack);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') return NextResponse.json({ error: message }, { status: 401 });
        if (message === 'Stack not found') return NextResponse.json({ error: message }, { status: 404 });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });

        const { id } = await params;
        const body = await request.json();
        const { name, description } = body;

        const stack = await updateStack(id, auth.organizationId, { name, description });
        return NextResponse.json(stack);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') return NextResponse.json({ error: message }, { status: 401 });
        if (message === 'Stack not found') return NextResponse.json({ error: message }, { status: 404 });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });

        const { id } = await params;
        await deleteStack(id, auth.organizationId);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') return NextResponse.json({ error: message }, { status: 401 });
        if (message === 'Stack not found') return NextResponse.json({ error: message }, { status: 404 });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
