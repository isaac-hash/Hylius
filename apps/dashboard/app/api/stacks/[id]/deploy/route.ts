import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../services/auth.service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });

        const { id } = await params;
        const { deployStack } = await import('../../../../../services/stack-deploy.service');

        const result = await deployStack({
            stackId: id,
            organizationId: auth.organizationId,
        });

        return NextResponse.json(result);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') return NextResponse.json({ error: message }, { status: 401 });
        if (message === 'Stack not found') return NextResponse.json({ error: message }, { status: 404 });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
