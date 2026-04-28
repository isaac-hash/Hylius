import { NextResponse } from 'next/server';
import { prisma } from '../../../services/prisma';

// Helper function to get current user from token (similar to getSession logic)
// Since this is just an API, we will just pass organizationId for now or rely on the same auth
import { headers } from 'next/headers';

// GET /api/alerts?organizationId=xxx
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
        return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    try {
        const alerts = await prisma.alert.findMany({
            where: { organizationId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        return NextResponse.json({ alerts });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH /api/alerts?organizationId=xxx
// Marks all as read, or a specific one if alertId is provided
export async function PATCH(request: Request) {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const alertId = searchParams.get('alertId');

    if (!organizationId) {
        return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    try {
        if (alertId) {
            await prisma.alert.update({
                where: { id: alertId },
                data: { isRead: true }
            });
        } else {
            await prisma.alert.updateMany({
                where: { organizationId, isRead: false },
                data: { isRead: true }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
