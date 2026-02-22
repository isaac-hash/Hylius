import { NextResponse } from 'next/server';
import { getAuthContext } from '../../../../services/auth.service';
import { prisma } from '../../../../services/prisma';

export async function GET(request: Request) {
    try {
        const auth = await getAuthContext(request);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: auth.userId },
            include: { organization: true },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
            },
            organization: {
                id: user.organization.id,
                name: user.organization.name,
                slug: user.organization.slug,
            },
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
