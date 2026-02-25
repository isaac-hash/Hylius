import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/services/auth.service';
import { prisma } from '@/services/prisma';

export async function GET(request: Request) {
    try {
        await requirePlatformAdmin(request);

        const [subscriptions, payments] = await Promise.all([
            prisma.subscription.findMany({
                include: {
                    organization: {
                        select: {
                            name: true,
                            slug: true,
                        }
                    }
                },
                orderBy: { updatedAt: 'desc' },
            }),
            prisma.payment.findMany({
                include: {
                    organization: {
                        select: {
                            name: true,
                            slug: true,
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: 100,
            })
        ]);

        return NextResponse.json({
            subscriptions,
            payments,
        });
    } catch (err: any) {
        console.error('Admin billing fetch failed:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
