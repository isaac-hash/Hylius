import { NextResponse } from 'next/server';
import { paymentService } from '@/services/payment/payment.service';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ provider: string }> }
) {
    const { provider } = await params;
    const providerId = provider.toUpperCase();
    const payload = await request.text();
    const signature = request.headers.get('stripe-signature') ||
        request.headers.get('x-paystack-signature') ||
        request.headers.get('verif-hash') || '';

    try {
        const eventData = JSON.parse(payload);
        await paymentService.handleWebhook(providerId, payload, signature, eventData);
        return NextResponse.json({ received: true });
    } catch (err: any) {
        console.error(`Webhook error (${providerId}):`, err.message);
        return NextResponse.json({ error: err.message }, { status: 400 });
    }
}
