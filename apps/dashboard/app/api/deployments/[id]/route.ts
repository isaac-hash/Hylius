import { NextResponse } from 'next/server';
import { requireAuth } from '@/services/auth.service';
import { prisma } from '@/services/prisma';

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) {
            return NextResponse.json({ error: 'Organization required' }, { status: 400 });
        }

        const params = await context.params;
        const deploymentId = params.id;

        const deployment = await prisma.deployment.findUnique({
            where: {
                id: deploymentId,
                organizationId: auth.organizationId,
            },
            include: {
                project: {
                    select: {
                        id: true,
                        name: true,
                        branch: true,
                        githubInstallationId: true,
                    }
                }
            }
        });

        if (!deployment) {
            return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
        }

        return NextResponse.json(deployment);
    } catch (error: any) {
        if (error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        console.error('Error fetching deployment:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
