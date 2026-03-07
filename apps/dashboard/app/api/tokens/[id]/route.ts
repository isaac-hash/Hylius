import { NextResponse } from 'next/server';
import { prisma } from '../../../../services/prisma';
import { requireAuth } from '../../../../services/auth.service';

/**
 * Handle DELETE /api/tokens/[id]
 * 
 * Revokes/deletes an API token.
 */
export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) {
            return NextResponse.json({ error: 'Organization required' }, { status: 400 });
        }

        const tokenId = params.id;
        if (!tokenId) {
            return NextResponse.json({ error: 'Token ID required' }, { status: 400 });
        }

        // Verify the token belongs to the organization
        const existingToken = await prisma.apiToken.findUnique({
            where: { id: tokenId }
        });

        if (!existingToken || existingToken.organizationId !== auth.organizationId) {
            return NextResponse.json({ error: 'Token not found or unauthorized' }, { status: 404 });
        }

        // Delete the token
        await prisma.apiToken.delete({
            where: { id: tokenId }
        });

        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        console.error('[API Tokens DELETE]', error);
        if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
