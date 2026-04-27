import { NextResponse } from 'next/server';
import { prisma } from '../../../../services/prisma';
import crypto from 'crypto';
import { sendEmail, getPasswordResetEmailTemplate } from '../../../../services/mail.service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email } = body;

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { email } });

        // Always return success even if user not found to prevent email enumeration
        if (!user) {
            return NextResponse.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
        }

        // Generate a secure random token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Save token to database
        await prisma.passwordResetToken.create({
            data: {
                userId: user.id,
                token: resetToken,
                expiresAt: tokenExpiry
            }
        });

        // Generate reset link
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

        // Send email
        await sendEmail({
            to: email,
            subject: 'Reset your Hylius password',
            htmlContent: getPasswordResetEmailTemplate(resetUrl)
        });

        return NextResponse.json({ success: true, message: 'If an account exists, a reset link has been sent.' });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Forgot password error:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
