import { NextResponse } from 'next/server';
import { prisma } from '../../../../../services/prisma';
import { requireAuth } from '../../../../../services/auth.service';

/**
 * GET /api/servers/[id]/metrics
 * Fetches historical metrics for the server, but only if the user is on a paid plan.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) {
            return NextResponse.json({ error: 'Organization required' }, { status: 400 });
        }

        const params = await context.params;
        const id = params.id;

        // Verify if organization has a paid plan
        let hasPaidPlan = false;
        const orgInfo = await prisma.organization.findUnique({
            where: { id: auth.organizationId }
        });

        if (orgInfo) {
            if (orgInfo.plan !== 'FREE') hasPaidPlan = true;
            
            const activeSub = await prisma.subscription.findFirst({
                where: { organizationId: auth.organizationId, status: 'ACTIVE' },
                include: { plan: true }
            });
            if (activeSub && activeSub.plan && activeSub.plan.amount > 0) {
                hasPaidPlan = true;
            }
        }

        if (!hasPaidPlan) {
            return NextResponse.json({ error: 'Historical metrics require a paid plan' }, { status: 403 });
        }

        // Fetch metrics
        const metrics = await prisma.metric.findMany({
            where: { serverId: id },
            orderBy: { createdAt: 'desc' },
            take: 100, // Get the latest 100
        });

        // Recharts prefers data in chronological order (ascending)
        return NextResponse.json(metrics.reverse());
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        console.error('Failed to fetch historical metrics:', message);
        return NextResponse.json({ error: `Failed to fetch metrics: ${message}` }, { status: 500 });
    }
}
