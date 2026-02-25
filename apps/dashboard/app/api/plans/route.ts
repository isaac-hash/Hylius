import { NextResponse } from 'next/server';
import { planService } from '@/services/payment/plan.service';

export async function GET() {
    try {
        const plans = await planService.listPlans(true); // Only active plans
        return NextResponse.json(plans);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
