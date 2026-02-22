import { NextResponse } from 'next/server';
import { prisma } from '../../../services/prisma';
import { requireAuth } from '../../../services/auth.service';

export async function GET(request: Request) {
    try {
        const auth = await requireAuth(request);
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        // Build where clause — always scoped to org via project
        const where: Record<string, unknown> = {
            project: { organizationId: auth.organizationId },
        };

        if (projectId) {
            where.projectId = projectId;
        }

        const deployments = await prisma.deployment.findMany({
            where,
            orderBy: { startedAt: 'desc' },
            take: 50,
            include: {
                project: {
                    select: { name: true },
                },
            },
        });

        return NextResponse.json(deployments);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
