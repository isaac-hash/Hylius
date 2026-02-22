import { NextResponse } from 'next/server';
import { prisma } from '../../../../services/prisma';
import { verifyPassword, createSession } from '../../../../services/auth.service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Missing required fields: email, password' },
                { status: 400 }
            );
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { email },
            include: { organization: true },
        });

        if (!user) {
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            );
        }

        // Verify password
        const valid = await verifyPassword(password, user.password);
        if (!valid) {
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            );
        }

        // Create session
        const session = await createSession(user.id);

        return NextResponse.json({
            token: session.token,
            expiresAt: session.expiresAt,
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
        console.error('Login error:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
