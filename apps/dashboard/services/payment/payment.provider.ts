// 1. Define specific interfaces for each provider
export interface PaystackWebhook {
    event: string;
    data: {
        id: number;
        domain: string;
        status: string;
        reference: string;
        amount: number;
        subscription_code?: string;
        next_payment_date?: string;
        currency?: string;
        metadata?: {
            custom_fields?: Array<{
                variable_name: string;
                value: string;
            }>;
            [key: string]: unknown;
        };
        customer?: {
            customer_code: string;
            email: string;
            [key: string]: unknown;
        };
        [key: string]: unknown;
    };
}

export interface StripeWebhook {
    id: string;
    type: string;
    data: {
        object: {
            id: string;
            object: string;
            customer: string;
            status: string;
            current_period_end: number;
            metadata?: Record<string, string | undefined>;
            [key: string]: unknown;
        };
        [key: string]: unknown;
    };
}

export interface FlutterwaveWebhook {
    event?: string;
    type?: string;
    data: {
        id: number;
        tx_ref: string;
        flw_ref: string;
        status: string;
        amount: number;
        currency?: string;
        payment_plan?: string;
        customer?: {
            id: number;
            email: string;
            [key: string]: unknown;
        };
        card?: {
            token: string;
            [key: string]: unknown;
        };
        meta?: {
            organizationId?: string;
            planId?: string;
            [key: string]: unknown;
        };
        [key: string]: unknown;
    };
    meta?: {
        organizationId?: string;
        planId?: string;
        [key: string]: unknown;
    };
    meta_data?: {
        organizationId?: string;
        planId?: string;
        [key: string]: unknown;
    };
}

// 2. Combine them into a Union Type
export type WebhookPayload = PaystackWebhook | StripeWebhook | FlutterwaveWebhook;


/**
 * Base abstraction for all payment providers (Stripe, Paystack, Flutterwave, etc.)
 */
export interface ParsedWebhookEvent {
    isSubscriptionChange: boolean;
    subscriptionId?: string;
    customerId?: string;
    status?: string; // 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE'
    currentPeriodEnd?: Date;
    organizationId?: string;
    // Payment specific
    isPayment?: boolean;
    amount?: number;
    currency?: string;
    transactionId?: string;
    // Provider specific identifiers for recurring billing
    flwCustomerId?: string;
    flwPaymentMethodId?: string;
    planId?: string;
}

export interface PaymentProviderAdapter {
    /**
     * Create a customer in the payment provider's system
     */
    createCustomer(email: string, name: string): Promise<string>;

    /**
     * Create a checkout session (or equivalent) to collect payment
     */
    createCheckoutSession(
        customerId: string,
        organizationId: string,
        providerPlanId: string,
        successUrl: string,
        cancelUrl: string,
        amount: number,
        currency: string,
        internalPlanId: string
    ): Promise<{ url: string; sessionId: string }>;

    /**
     * Cancel an active subscription
     */
    cancelSubscription(subscriptionId: string): Promise<void>;

    /**
     * Verify a webhook payload from the provider
     */
    verifyWebhookSignature(payload: string, signature: string): boolean;

    /**
     * Parse and standardize provider-specific webhook payloads
     */
    parseWebhookEvent(payload: WebhookPayload): ParsedWebhookEvent;
}
