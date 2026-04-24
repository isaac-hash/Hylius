import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/services/auth.service';
import { planService } from '@/services/payment/plan.service';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requirePlatformAdmin(request);
        const { id } = await params;
        const plan = await planService.getPlan(id);
        if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
        return NextResponse.json(plan);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requirePlatformAdmin(request);
        const { id } = await params;
        await planService.deletePlan(id);
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

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
