import { PaymentProviderAdapter, ParsedWebhookEvent } from './payment.provider';
import { prisma } from '../prisma';

export class FlutterwaveAdapter implements PaymentProviderAdapter {
    private secretKey = process.env.FLUTTERWAVE_SECRET_KEY || '';
    private publicKey = process.env.FLUTTERWAVE_PUBLIC_KEY || '';
    private encryptionKey = process.env.FLUTTERWAVE_ENCRYPTION_KEY || '';
    private webhookSecret = process.env.FLUTTERWAVE_WEBHOOK_SECRET || '';
    private baseUrl = 'https://api.flutterwave.com/v3';

    constructor() {
        if (!this.webhookSecret) {
            console.warn('FLUTTERWAVE_WEBHOOK_SECRET (secret hash) is missing. Webhook verification will fail.');
        }
    }

    private getHeaders() {
        return {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
        };
    }

    async createCustomer(email: string, name: string): Promise<string> {
        // Flutterwave doesn't have a strict customer creation requirement before payments 
        // unlike Stripe, but we can just return the email or a generated ID to identify them.
        return email;
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
        const txRef = `tx_flw_${Date.now()}`;

        const payload: any = {
            tx_ref: txRef,
            amount,
            currency,
            redirect_url: successUrl,
            customer: {
                email: customerId, // customerId is the email
                name: "Customer",
            },
            meta: {
                organizationId,
                planId: internalPlanId
            },
            customizations: {
                title: `Hylius Subscription`,
            }
        };

        // If it's a flutterwave plan (subscription), add the plan id
        if (providerPlanId) {
            payload.payment_plan = providerPlanId;
            // When using payment_plan, Flutterwave sometimes ignores the amount on the request
            // in favor of the plan's amount, but it's good to keep it.
        }

        const res = await fetch(`${this.baseUrl}/payments`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data.status !== 'success') throw new Error(data.message || 'Flutterwave initialization failed');

        return {
            url: data.data.link,
            sessionId: txRef,
        };
    }

    async cancelSubscription(subscriptionId: string): Promise<void> {
        const res = await fetch(`${this.baseUrl}/subscriptions/${subscriptionId}/cancel`, {
            method: 'PUT',
            headers: this.getHeaders(),
        });
        const data = await res.json();
        if (data.status !== 'success') throw new Error(data.message || 'Flutterwave cancel failed');
    }

    verifyWebhookSignature(payload: string, signature: string): boolean {
        // Flutterwave passes the signature verif-hash in the headers
        return signature === this.webhookSecret;
    }

    parseWebhookEvent(payload: any): ParsedWebhookEvent {
        // Handle both v3 (event) and v4 (type) payload structures
        const event = payload.event || payload.type;
        const data = payload.data;

        if (!data || (event !== 'charge.completed' && event !== 'charge.succeeded')) {
            return { isSubscriptionChange: false, isPayment: false };
        }

        // Handle both 'successful' (v3) and 'succeeded' (v4)
        const isSuccessful = data.status === 'successful' || data.status === 'succeeded';
        const isSubscription = !!data.payment_plan;

        return {
            isSubscriptionChange: isSubscription,
            isPayment: true,
            transactionId: data.tx_ref || data.id?.toString(),
            amount: data.amount,
            currency: data.currency,
            subscriptionId: isSubscription ? (data.id ? data.id.toString() : data.tx_ref) : undefined,
            customerId: data.customer?.email,
            status: isSuccessful ? 'ACTIVE' : 'INCOMPLETE',
            currentPeriodEnd: undefined, // Flutterwave doesn't always provide this in the charge.completed event
            organizationId: data.meta?.organizationId || payload.meta?.organizationId,
            flwCustomerId: data.customer?.id?.toString(),
            flwPaymentMethodId: data.card?.token,
            planId: data.meta?.planId
        };
    }
}
