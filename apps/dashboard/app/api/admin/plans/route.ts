import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/services/auth.service';
import { planService } from '@/services/payment/plan.service';

export async function GET(request: Request) {
    try {
        await requirePlatformAdmin(request);
        const plans = await planService.listPlans();
        return NextResponse.json(plans);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await requirePlatformAdmin(request);
        const data = await request.json();

        if (!data.name || !data.amount) {
            return NextResponse.json({ error: 'Name and amount are required' }, { status: 400 });
        }

        const plan = await planService.createPlan(data);
        return NextResponse.json(plan);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
