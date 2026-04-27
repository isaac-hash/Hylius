import { NextResponse } from 'next/server';
import { prisma } from '../../../../services/prisma';
import { hashPassword, createSession } from '../../../../services/auth.service';
import { Prisma } from '@prisma/client';

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

        // Generate 6-digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Create organization, user, and otp token in a transaction
        const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

            await tx.otpToken.create({
                data: {
                    userId: user.id,
                    code: otpCode,
                    expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
                }
            });

            return { user, organization };
        });

        // Send OTP email
        const { sendEmail, getOtpEmailTemplate } = await import('../../../../services/mail.service');
        await sendEmail({
            to: email,
            subject: 'Verify your Hylius account',
            htmlContent: getOtpEmailTemplate(otpCode)
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
                isEmailVerified: false,
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
