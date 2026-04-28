import { NextResponse } from 'next/server';
import { requireAuth } from '../../../services/auth.service';
import { createStack, getStacks } from '../../../services/stack.service';

export async function GET(request: Request) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });

        const stacks = await getStacks(auth.organizationId);
        return NextResponse.json(stacks);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') return NextResponse.json({ error: message }, { status: 401 });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });

        const body = await request.json();
        const { name, description, serverId } = body;

        if (!name || !serverId) {
            return NextResponse.json({ error: 'Missing required fields: name, serverId' }, { status: 400 });
        }

        const stack = await createStack({
            name,
            description,
            serverId,
            organizationId: auth.organizationId,
        });

        return NextResponse.json(stack);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') return NextResponse.json({ error: message }, { status: 401 });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
