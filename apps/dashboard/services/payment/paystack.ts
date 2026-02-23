import { PaymentProviderAdapter, ParsedWebhookEvent } from './payment.provider';
import * as crypto from 'crypto';

export class PaystackAdapter implements PaymentProviderAdapter {
    private secretKey = 'sk_test_b2dc57e3bdb7ce7837caa38d4414fee46de6e5b3';
    private publicKey = 'pk_test_6633afe27e72a0911dc341b64dfa28fb9c124c8a';
    private baseUrl = 'https://api.paystack.co';

    constructor() {
        console.log(`[PaystackAdapter] Initialized with key starting with: ${this.secretKey.substring(0, 8)}`);
    }

    private getHeaders() {
        return {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
        };
    }

    async createCustomer(email: string, name: string): Promise<string> {
        const res = await fetch(`${this.baseUrl}/customer`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ email, first_name: name }),
        });
        const data = await res.json();
        if (!data.status) throw new Error(data.message || 'Paystack customer creation failed');
        return data.data.customer_code;
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
        console.log(`[PaystackAdapter] using secret key: ${this.secretKey.substring(0, 8)}...`);
        // Find email by customer code
        const cusRes = await fetch(`${this.baseUrl}/customer/${customerId}`, { headers: this.getHeaders() });
        const cusData = await cusRes.json();
        if (!cusData.status) throw new Error('Paystack customer not found');

        const payload = {
            email: cusData.data.email,
            amount: Math.round(amount * 100), // Convert to kobo (integer)
            currency: currency,
            plan: providerPlanId,
            callback_url: successUrl,
            metadata: {
                organizationId,
                internalPlanId,
                custom_fields: [
                    { variable_name: "organizationId", value: organizationId }
                ]
            }
        };

        console.log('[PaystackAdapter] Initializing transaction with payload:', JSON.stringify(payload, null, 2));

        const res = await fetch(`${this.baseUrl}/transaction/initialize`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.status) {
            console.error('[PaystackAdapter] Initialization failed for plan:', providerPlanId);
            console.error('[PaystackAdapter] Headers used:', this.getHeaders());
            console.error('[PaystackAdapter] Response data:', JSON.stringify(data, null, 2));
            throw new Error(data.message || 'Paystack initialization failed');
        }

        return {
            url: data.data.authorization_url,
            sessionId: data.data.reference,
        };
    }

    async cancelSubscription(subscriptionId: string): Promise<void> {
        // Paystack cancellation requires subscription code and email token
        const res = await fetch(`${this.baseUrl}/subscription/disable`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ code: subscriptionId, token: "placeholder_token" }),
        });
        const data = await res.json();
        if (!data.status) throw new Error(data.message || 'Paystack cancel failed');
    }

    verifyWebhookSignature(payload: string, signature: string): boolean {
        // Paystack uses the Secret Key to sign webhook payloads, there is no separate webhook secret
        const hash = crypto.createHmac('sha512', this.secretKey).update(payload).digest('hex');
        return hash === signature;
    }

    parseWebhookEvent(payload: any): ParsedWebhookEvent {
        const event = payload.event;
        const data = payload.data;

        const isSubscription = event === 'subscription.create' || event === 'subscription.disable';
        const isPayment = event === 'charge.success';

        // If it's a charge.success with a subscription_code, it's ALSO a subscription change
        const isSubscriptionPayment = isPayment && !!data.subscription_code;

        if (!isSubscription && !isPayment) {
            return { isSubscriptionChange: false };
        }

        let internalStatus = 'INCOMPLETE';

        // Map status for subscription events
        if (data.status === 'active' || data.status === 'success') internalStatus = 'ACTIVE';
        if (data.status === 'non-renewing' || data.status === 'cancelled') internalStatus = 'CANCELED';
        if (data.status === 'past_due' || data.status === 'failed') internalStatus = 'PAST_DUE';

        let organizationId = undefined;
        if (data.metadata && data.metadata.custom_fields) {
            const orgField = data.metadata.custom_fields.find((f: any) => f.variable_name === 'organizationId');
            if (orgField) organizationId = orgField.value;
        }

        return {
            isSubscriptionChange: isSubscription || isSubscriptionPayment,
            isPayment: isPayment,
            subscriptionId: data.subscription_code || undefined,
            customerId: data.customer?.customer_code || data.customer?.email,
            status: internalStatus,
            currentPeriodEnd: data.next_payment_date ? new Date(data.next_payment_date) : undefined,
            organizationId,
            // Payment fields
            amount: data.amount ? data.amount / 100 : undefined, // Paystack is in kobo
            currency: data.currency || 'NGN',
            transactionId: data.reference
        };
    }
}
