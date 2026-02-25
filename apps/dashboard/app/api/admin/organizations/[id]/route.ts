import { NextResponse } from 'next/server';
import { prisma } from '../../../../../services/prisma';
import { AuthService } from '../../../../../services/auth.service';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await AuthService.requirePlatformAdmin(request);
        const { id } = await params;
        const { isActive } = await request.json();

        if (typeof isActive !== 'boolean') {
            return NextResponse.json({ error: 'isActive must be a boolean' }, { status: 400 });
        }

        const org = await prisma.organization.update({
            where: { id },
            data: { isActive }
        });

        return NextResponse.json(org);
    } catch (error: any) {
        if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (error.message === 'Forbidden: Platform Admin access required') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
