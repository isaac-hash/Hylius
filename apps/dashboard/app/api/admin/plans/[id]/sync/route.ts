import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/services/auth.service';
import { planService } from '@/services/payment/plan.service';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requirePlatformAdmin(request);
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const provider = searchParams.get('provider') || 'PAYSTACK';

        let plan;
        if (provider === 'FLUTTERWAVE') {
            plan = await planService.syncWithFlutterwave(id);
        } else {
            plan = await planService.syncWithPaystack(id);
        }

        return NextResponse.json(plan);
    } catch (err: any) {
        console.error('Plan sync failed:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
