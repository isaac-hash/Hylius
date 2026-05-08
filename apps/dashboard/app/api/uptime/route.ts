import { NextResponse } from 'next/server';
import { prisma } from '../../../services/prisma';
import { requireAuth } from '../../../services/auth.service';

export async function GET(request: Request) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });

        // Get all monitors for servers owned by this org
        const monitors = await prisma.uptimeMonitor.findMany({
            where: {
                server: {
                    organizationId: auth.organizationId
                }
            },
            include: {
                server: { select: { id: true, name: true, ip: true, status: true } },
                project: { select: { id: true, name: true } },
                incidents: {
                    orderBy: { startedAt: 'desc' },
                    take: 5
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return NextResponse.json(monitors);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
