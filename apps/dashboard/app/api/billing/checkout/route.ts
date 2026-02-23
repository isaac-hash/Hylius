import { NextResponse } from 'next/server';
import { requireAuth } from '@/services/auth.service';
import { paymentService } from '@/services/payment/payment.service';

export async function POST(request: Request) {
    try {
        const auth = await requireAuth(request);
        const { providerId, planId } = await request.json();

        if (!providerId || !planId) {
            return NextResponse.json({ error: 'Missing providerId or planId' }, { status: 400 });
        }

        console.log(`[CheckoutAPI] Starting checkout for plan ${planId} via ${providerId}`);

        // Generate checkout URL
        const checkoutUrl = await paymentService.createSubscriptionCheckout(
            auth.organizationId as string,
            providerId,
            auth.email,
            auth.email.split('@')[0], // Use email prefix as name
            planId
        );

        return NextResponse.json({ url: checkoutUrl });
    } catch (err: any) {
        console.error('Checkout creation failed:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
