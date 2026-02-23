import { NextResponse } from 'next/server';
import { prisma } from '../../../../services/prisma';
import { AuthService } from '../../../../services/auth.service';

export async function GET(request: Request) {
    try {
        await AuthService.requirePlatformAdmin(request);

        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limitStr = url.searchParams.get('limit');
        let limit = limitStr ? parseInt(limitStr, 10) : 50; // Activity feeds can have a higher default

        if (limit > 200) limit = 200;
        if (limit < 1) limit = 20;

        const skip = (page - 1) * limit;

        const [activity, total] = await Promise.all([
            prisma.auditLog.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.auditLog.count()
        ]);

        return NextResponse.json({
            activity,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error: any) {
        if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (error.message === 'Forbidden: Platform Admin access required') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
