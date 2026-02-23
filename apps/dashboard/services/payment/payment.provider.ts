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
    parseWebhookEvent(payload: any): ParsedWebhookEvent;
}
