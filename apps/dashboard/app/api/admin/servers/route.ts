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

        if (limit > 100) limit = 100;
        if (limit < 1) limit = 20;

        const skip = (page - 1) * limit;

        const [servers, total] = await Promise.all([
            prisma.server.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    organization: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                        }
                    },
                    _count: {
                        select: {
                            projects: true,
                            metrics: true,
                        }
                    },
                    metrics: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        select: { createdAt: true, cpu: true, memory: true, disk: true }
                    }
                }
            }),
            prisma.server.count()
        ]);

        return NextResponse.json({
            servers,
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
