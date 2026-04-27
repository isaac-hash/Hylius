import { NextResponse } from 'next/server';
import { prisma } from '../../../../services/prisma';
import { hashPassword } from '../../../../services/auth.service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { token, newPassword } = body;

        if (!token || !newPassword) {
            return NextResponse.json({ error: 'Token and new password are required' }, { status: 400 });
        }

        if (newPassword.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
        }

        // Find token
        const resetToken = await prisma.passwordResetToken.findUnique({
            where: { token },
            include: { user: true }
        });

        if (!resetToken) {
            return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 });
        }

        // Check if expired
        if (new Date() > resetToken.expiresAt) {
            await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });
            return NextResponse.json({ error: 'Reset token has expired' }, { status: 400 });
        }

        // Hash new password
        const hashedPw = await hashPassword(newPassword);

        // Update user
        await prisma.user.update({
            where: { id: resetToken.userId },
            data: { password: hashedPw }
        });

        // Delete all reset tokens for this user
        await prisma.passwordResetToken.deleteMany({
            where: { userId: resetToken.userId }
        });
        
        // Optionally, invalidate existing sessions
        await prisma.session.deleteMany({
            where: { userId: resetToken.userId }
        });

        return NextResponse.json({ success: true, message: 'Password has been reset successfully' });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Reset password error:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
