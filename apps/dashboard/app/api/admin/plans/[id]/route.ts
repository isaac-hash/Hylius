import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/services/auth.service';
import { planService } from '@/services/payment/plan.service';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requirePlatformAdmin(request);
        const { id } = await params;
        const data = await request.json();

        const plan = await planService.updatePlan(id, data);
        return NextResponse.json(plan);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
