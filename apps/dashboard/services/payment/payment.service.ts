import { prisma } from '../prisma';
import { StripeAdapter } from './stripe';
import { PaystackAdapter } from './paystack';
import { FlutterwaveAdapter } from './flutterwave';
import { PaymentProviderAdapter } from './payment.provider';

export class PaymentService {
    private providers: Record<string, PaymentProviderAdapter> = {
        'STRIPE': new StripeAdapter(),
        'PAYSTACK': new PaystackAdapter(),
        'FLUTTERWAVE': new FlutterwaveAdapter()
    };

    /**
     * Normalize external subscription status to internal standard
     */
    normalizeStatus(externalStatus: string): string {
        const statusMap: Record<string, string> = {
            'active': 'ACTIVE',
            'past_due': 'PAST_DUE',
            'canceled': 'CANCELED',
            'cancelled': 'CANCELED',
            'incomplete': 'INCOMPLETE',
            'trialing': 'TRIALING',
        };
        return statusMap[externalStatus.toLowerCase()] || 'INCOMPLETE';
    }

    /**
     * Start a checkout flow, routing to the optimal provider.
     */
    async createSubscriptionCheckout(organizationId: string, providerId: string, email: string, name: string, planId: string) {
        const provider = this.providers[providerId];
        if (!provider) throw new Error(`Provider ${providerId} not supported.`);

        // 1. Resolve local plan
        const plan = await prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) throw new Error('Plan not found');

        // 2. Validate provider sync
        if (providerId === 'PAYSTACK' && !plan.paystackPlanCode) {
            throw new Error('This plan has not been synchronized with Paystack yet.');
        }
        if (providerId === 'FLUTTERWAVE' && !plan.flutterwavePlanId) {
            throw new Error('This plan has not been synchronized with Flutterwave yet.');
        }

        // 3. Create external customer
        const customerId = await provider.createCustomer(email, name);

        // 4. Create Checkout Session
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        // Pass the external ID (paystack/flutterwave)
        let providerPlanId: string | undefined = undefined;
        if (providerId === 'PAYSTACK') providerPlanId = plan.paystackPlanCode!;
        if (providerId === 'FLUTTERWAVE') providerPlanId = plan.flutterwavePlanId!;

        if (!providerPlanId) throw new Error('Could not resolve provider plan identifier');

        const session = await provider.createCheckoutSession(
            customerId,
            organizationId,
            providerPlanId,
            `${baseUrl}/success`,
            `${baseUrl}/cancel`,
            plan.amount,
            plan.currency,
            plan.id
        );

        return session.url;
    }

    /**
     * Handle webhook coming from a payment provider
     * Webhooks modify DB directly here ONLY.
     */
    async handleWebhook(providerId: string, payload: string, signature: string, eventData: any) {
        const provider = this.providers[providerId];
        if (!provider) throw new Error('Unknown provider');

        // 1. Verify Signature (Skip Stripe since they verify upon event construct)
        if (providerId !== 'STRIPE') {
            const isValid = provider.verifyWebhookSignature(payload, signature);
            if (!isValid && process.env.NODE_ENV === 'production') {
                console.warn(`Invalid webhook signature from ${providerId}`);
                return;
            }
        }

        // 2. Parse Event via Provider
        const parsedEvent = provider.parseWebhookEvent(eventData);
        console.log(`[PaymentService] Processing ${providerId} event:`, {
            event: eventData.event,
            isPayment: parsedEvent.isPayment,
            isSubscription: parsedEvent.isSubscriptionChange
        });

        // 2.a Record Payment if it's a payment event
        if (parsedEvent.isPayment && parsedEvent.transactionId && parsedEvent.amount) {
            let resolvedOrgId = parsedEvent.organizationId;
            if (!resolvedOrgId && parsedEvent.customerId) {
                const existing = await prisma.subscription.findFirst({
                    where: { externalCustomerId: parsedEvent.customerId }
                });
                if (existing) resolvedOrgId = existing.organizationId;
            }

            if (resolvedOrgId) {
                await prisma.payment.upsert({
                    where: { externalTransactionId: parsedEvent.transactionId },
                    update: { status: 'SUCCESS' }, // Usually success in webhook, but we use upsert to be safe
                    create: {
                        organizationId: resolvedOrgId,
                        provider: providerId,
                        externalTransactionId: parsedEvent.transactionId,
                        amount: parsedEvent.amount,
                        currency: parsedEvent.currency || 'USD',
                        status: 'SUCCESS'
                    }
                });
            }
        }

        if (parsedEvent.isSubscriptionChange && parsedEvent.subscriptionId && parsedEvent.status) {
            const { subscriptionId, customerId, status, currentPeriodEnd, organizationId } = parsedEvent;

            // 3. Resolve organizationId if missing from payload but customer is linked
            let resolvedOrgId = organizationId;
            if (!resolvedOrgId && customerId) {
                const existing = await prisma.subscription.findFirst({
                    where: { externalCustomerId: customerId }
                });
                if (existing) resolvedOrgId = existing.organizationId;
            }

            if (!resolvedOrgId) {
                console.warn(`[PaymentService] Webhook ignored: Could not resolve organizationId for subscription ${subscriptionId}`);
                console.log(`[PaymentService] Parsed event data:`, JSON.stringify(parsedEvent, null, 2));
                return;
            }

            // 4. Upsert subscription tracking
            const existingSub = await prisma.subscription.findFirst({
                where: { externalSubId: subscriptionId }
            });

            if (existingSub) {
                await prisma.subscription.update({
                    where: { id: existingSub.id },
                    data: {
                        status,
                        currentPeriodEnd: currentPeriodEnd || existingSub.currentPeriodEnd,
                        flutterwaveCustomerId: parsedEvent.flwCustomerId,
                        flutterwavePaymentMethodId: parsedEvent.flwPaymentMethodId,
                        planId: parsedEvent.planId,
                        updatedAt: new Date()
                    }
                });
            } else {
                await prisma.subscription.create({
                    data: {
                        organizationId: resolvedOrgId,
                        provider: providerId,
                        externalCustomerId: customerId || '',
                        externalSubId: subscriptionId,
                        status,
                        currentPeriodEnd: currentPeriodEnd || new Date(),
                        flutterwaveCustomerId: parsedEvent.flwCustomerId,
                        flutterwavePaymentMethodId: parsedEvent.flwPaymentMethodId,
                        planId: parsedEvent.planId
                    }
                });
            }

            // 5. Upgrade or Downgrade Organization Plans
            if (status === 'ACTIVE') {
                await prisma.organization.update({
                    where: { id: resolvedOrgId },
                    data: { plan: 'PRO' }
                });
            } else if (status === 'CANCELED' || status === 'PAST_DUE') {
                await prisma.organization.update({
                    where: { id: resolvedOrgId },
                    data: { plan: 'FREE' }
                });
            }

            // Log the determination
            await prisma.auditLog.create({
                data: {
                    action: 'SUBSCRIPTION_DETERMINED',
                    organizationId: resolvedOrgId,
                    metadata: JSON.stringify({ status, provider: providerId })
                }
            });
        }
    }
}

export const paymentService = new PaymentService();
