import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '../../../services/prisma';
import { requireAuth } from '../../../services/auth.service';

/**
 * Handle GET /api/tokens
 * 
 * Returns a list of all API tokens for the logged-in user's organization.
 */
export async function GET(request: Request) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) {
            return NextResponse.json({ error: 'Organization required' }, { status: 400 });
        }

        const tokens = await prisma.apiToken.findMany({
            where: { organizationId: auth.organizationId },
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, lastUsedAt: true, createdAt: true }
            // Note: hashedToken is deliberately omitted from the response
        });

        return NextResponse.json(tokens);
    } catch (error: any) {
        console.error('[API Tokens GET]', error);
        if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * Handle POST /api/tokens
 * 
 * Creates a new API token for the logged-in user's organization.
 * The raw token is ONLY returned once in this response and cannot be retrieved again.
 */
export async function POST(request: Request) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) {
            return NextResponse.json({ error: 'Organization required' }, { status: 400 });
        }

        const body = await request.json();
        const { name } = body;

        if (!name || typeof name !== 'string') {
            return NextResponse.json({ error: 'Valid name required' }, { status: 400 });
        }

        // Generate a new 32-byte secure random token
        // Prefix with 'hyl_' for easy identification by users
        const rawToken = 'hyl_' + crypto.randomBytes(32).toString('hex');

        // Hash the token for storage
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

        const apiToken = await prisma.apiToken.create({
            data: {
                name,
                hashedToken,
                organizationId: auth.organizationId,
            },
            select: { id: true, name: true, lastUsedAt: true, createdAt: true }
        });

        // Return the newly created record PLUS the raw token
        // The frontend must display rawToken to the user now
        return NextResponse.json({ ...apiToken, token: rawToken });

    } catch (error: any) {
        console.error('[API Tokens POST]', error);
        if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
