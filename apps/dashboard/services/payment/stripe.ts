import { PaymentProviderAdapter, ParsedWebhookEvent } from './payment.provider';
import Stripe from 'stripe';

export class StripeAdapter implements PaymentProviderAdapter {
    private stripe: Stripe;
    private publicKey: string;
    private webhookSecret: string;

    constructor() {
        this.publicKey = process.env.STRIPE_PUBLIC_KEY || '';
        this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
            apiVersion: '2024-10-28.acacia' as any
        });
        this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

        if (!this.webhookSecret) {
            console.warn('STRIPE_WEBHOOK_SECRET is missing. Webhook verification will fail.');
        }
    }

    async createCustomer(email: string, name: string): Promise<string> {
        const customer = await this.stripe.customers.create({ email, name });
        return customer.id;
    }

    async createCheckoutSession(
        customerId: string,
        organizationId: string,
        providerPlanId: string,
        successUrl: string,
        cancelUrl: string,
        amount: number,
        currency: string,
        internalPlanId: string
    ): Promise<{ url: string; sessionId: string }> {
        const session = await this.stripe.checkout.sessions.create({
            customer: customerId,
            line_items: [{ price: providerPlanId, quantity: 1 }],
            mode: 'subscription',
            success_url: successUrl,
            cancel_url: cancelUrl,
            subscription_data: {
                metadata: { organizationId, internalPlanId }
            }
        });

        if (!session.url) throw new Error('Stripe failed to return a checkout URL');

        return { url: session.url, sessionId: session.id };
    }

    async cancelSubscription(subscriptionId: string): Promise<void> {
        await this.stripe.subscriptions.cancel(subscriptionId);
    }

    verifyWebhookSignature(payload: string, signature: string): boolean {
        try {
            this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
            return true;
        } catch (err) {
            return false;
        }
    }

    parseWebhookEvent(payload: any): ParsedWebhookEvent {
        const type = payload.type;
        const isSubscription = type && type.startsWith('customer.subscription.');

        if (!isSubscription) {
            return { isSubscriptionChange: false };
        }

        const obj = payload.data.object;
        let internalStatus = 'INCOMPLETE';
        if (obj.status === 'active') internalStatus = 'ACTIVE';
        if (obj.status === 'canceled') internalStatus = 'CANCELED';
        if (obj.status === 'past_due') internalStatus = 'PAST_DUE';

        return {
            isSubscriptionChange: true,
            subscriptionId: obj.id,
            customerId: obj.customer,
            status: internalStatus,
            currentPeriodEnd: new Date(obj.current_period_end * 1000),
            organizationId: obj.metadata?.organizationId
        };
    }
}
