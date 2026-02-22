import { NextResponse } from 'next/server';
import { prisma } from '../../../../services/prisma';
import { hashPassword, createSession } from '../../../../services/auth.service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password, orgName } = body;

        if (!email || !password || !orgName) {
            return NextResponse.json(
                { error: 'Missing required fields: email, password, orgName' },
                { status: 400 }
            );
        }

        // Check if email already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return NextResponse.json(
                { error: 'Email already registered' },
                { status: 409 }
            );
        }

        // Create organization + user in a transaction
        const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        const result = await prisma.$transaction(async (tx) => {
            const organization = await tx.organization.create({
                data: {
                    name: orgName,
                    slug,
                },
            });

            const hashedPw = await hashPassword(password);

            const user = await tx.user.create({
                data: {
                    email,
                    password: hashedPw,
                    role: 'OWNER',
                    organizationId: organization.id,
                },
            });

            return { user, organization };
        });

        // Create session
        const session = await createSession(result.user.id);

        return NextResponse.json({
            token: session.token,
            expiresAt: session.expiresAt,
            user: {
                id: result.user.id,
                email: result.user.email,
                role: result.user.role,
            },
            organization: {
                id: result.organization.id,
                name: result.organization.name,
                slug: result.organization.slug,
            },
        }, { status: 201 });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Registration error:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
