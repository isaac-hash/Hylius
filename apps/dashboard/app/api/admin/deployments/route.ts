import { NextResponse } from 'next/server';
import { prisma } from '../../../../services/prisma';
import { AuthService } from '../../../../services/auth.service';

export async function GET(request: Request) {
    try {
        await AuthService.requirePlatformAdmin(request);

        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limitStr = url.searchParams.get('limit');
        let limit = limitStr ? parseInt(limitStr, 10) : 20;
        const status = url.searchParams.get('status'); // Filter by status

        if (limit > 100) limit = 100;
        if (limit < 1) limit = 20;

        const skip = (page - 1) * limit;

        const where: Record<string, unknown> = {};
        if (status) {
            where.status = status;
        }

        const [deployments, total] = await Promise.all([
            prisma.deployment.findMany({
                skip,
                take: limit,
                where,
                orderBy: { startedAt: 'desc' },
                include: {
                    project: {
                        select: {
                            name: true,
                            server: {
                                select: {
                                    name: true,
                                    ip: true,
                                }
                            },
                            organization: {
                                select: {
                                    name: true,
                                    slug: true,
                                }
                            }
                        }
                    }
                }
            }),
            prisma.deployment.count({ where })
        ]);

        return NextResponse.json({
            deployments,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error: unknown) {
        if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (error.message === 'Forbidden: Platform Admin access required') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
