import { NextResponse } from 'next/server';
import { requireAuth } from '@/services/auth.service';
import { prisma } from '@/services/prisma';

export async function GET(request: Request) {
    try {
        const auth = await requireAuth(request);

        if (!auth.organizationId) {
            return NextResponse.json({ error: 'No organization found' }, { status: 404 });
        }

        const [subscription, payments] = await Promise.all([
            prisma.subscription.findFirst({
                where: { organizationId: auth.organizationId },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.payment.findMany({
                where: { organizationId: auth.organizationId },
                orderBy: { createdAt: 'desc' },
                take: 50,
            })
        ]);

        return NextResponse.json({
            subscription,
            payments,
        });
    } catch (err: any) {
        console.error('Failed to fetch billing history:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
