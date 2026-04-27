import { NextResponse } from 'next/server';
import { prisma } from '../../../../services/prisma';
import { getAuthContext } from '../../../../services/auth.service';

export async function POST(request: Request) {
    try {
        const auth = await getAuthContext(request);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { code } = body;

        if (!code) {
            return NextResponse.json({ error: 'OTP code is required' }, { status: 400 });
        }

        // Find a valid OTP token for this user
        const otpToken = await prisma.otpToken.findFirst({
            where: {
                userId: auth.userId,
                code: code,
            },
        });

        if (!otpToken) {
            return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
        }

        if (new Date() > otpToken.expiresAt) {
            // Delete expired token
            await prisma.otpToken.delete({ where: { id: otpToken.id } });
            return NextResponse.json({ error: 'Verification code has expired. Please request a new one.' }, { status: 400 });
        }

        // Mark user as verified
        await prisma.user.update({
            where: { id: auth.userId },
            data: { isEmailVerified: true }
        });

        // Delete used token
        await prisma.otpToken.delete({ where: { id: otpToken.id } });

        return NextResponse.json({ success: true, message: 'Email verified successfully' });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Verification error:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
