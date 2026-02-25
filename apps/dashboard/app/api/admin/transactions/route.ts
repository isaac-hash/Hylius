import { NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';
import { requirePlatformAdmin } from '@/services/auth.service';

export async function GET(request: Request) {
    try {
        await requirePlatformAdmin(request);

        const transactions = await prisma.payment.findMany({
            include: {
                organization: {
                    select: {
                        name: true,
                        slug: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return NextResponse.json(transactions);
    } catch (error) {
        console.error('[Admin Transactions API] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
