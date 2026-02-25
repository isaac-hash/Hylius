/**
 * test-paystack.ts
 *
 * End-to-end integration test for the Paystack payment adapter.
 * Runs directly against Paystack's test environment — no Next.js server needed.
 *
 * Usage:
 *   npx tsx test-paystack.ts
 */
import * as crypto from 'crypto';
import { PaystackAdapter } from './services/payment/paystack';

// ─── Helpers ────────────────────────────────────────────────────────────────

const SECRET_KEY = 'sk_test_b2dc57e3bdb7ce7837caa38d4414fee46de6e5b3';
const BASE_URL = 'https://api.paystack.co';

const headers = {
    Authorization: `Bearer ${SECRET_KEY}`,
    'Content-Type': 'application/json',
};

let passed = 0;
let failed = 0;

function pass(label: string, value?: any) {
    passed++;
    const display = value !== undefined
        ? (typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value))
        : '';
    console.log(`  ✅  ${label}${display ? '\n      → ' + display.split('\n').join('\n        ') : ''}`);
}

function fail(label: string, err: any) {
    failed++;
    console.error(`  ❌  ${label}`);
    console.error(`      ${err?.message ?? err}`);
}

function heading(title: string) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  ${title}`);
    console.log(`${'─'.repeat(60)}`);
}

// ─── Step 1: Create a real Paystack plan ────────────────────────────────────

async function createTestPlan(): Promise<string> {
    heading('Step 1 – Create a temporary Paystack plan');

    const name = `Test Plan ${Date.now()}`;
    const res = await fetch(`${BASE_URL}/plan`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            name,
            interval: 'monthly',
            amount: 500000, // ₦5,000 in kobo
        }),
    });
    const data = await res.json();

    if (!data.status || !data.data?.plan_code) {
        fail('Create plan', new Error(data.message ?? JSON.stringify(data)));
        throw new Error('Cannot continue without a real plan code');
    }

    pass('Plan created', { plan_code: data.data.plan_code, name: data.data.name, amount: data.data.amount });
    return data.data.plan_code;
}

// ─── Step 2: createCustomer ─────────────────────────────────────────────────

async function testCreateCustomer(adapter: PaystackAdapter): Promise<string> {
    heading('Step 2 – createCustomer');

    const testEmail = `test+${Date.now()}@hylius-dev.com`;
    try {
        const customerId = await adapter.createCustomer(testEmail, 'Test User');
        if (!customerId.startsWith('CUS_')) {
            fail('createCustomer', new Error(`Expected CUS_xxx, got: ${customerId}`));
        } else {
            pass('createCustomer', { customerId, email: testEmail });
        }
        return customerId;
    } catch (err: any) {
        fail('createCustomer', err);
        throw err;
    }
}

// ─── Step 3: createCheckoutSession ──────────────────────────────────────────

async function testCreateCheckoutSession(
    adapter: PaystackAdapter,
    customerId: string,
    planCode: string
): Promise<void> {
    heading('Step 3 – createCheckoutSession');

    try {
        const session = await adapter.createCheckoutSession(
            customerId,
            'test_org_123',
            planCode,
            'https://hylius.dev/success',
            'https://hylius.dev/cancel',
            5000, // amount
            'NGN',  // currency
            'test_internal_plan_id'
        );

        if (!session.url.startsWith('https://')) {
            fail('createCheckoutSession URL', new Error(`Unexpected URL: ${session.url}`));
        } else {
            pass('createCheckoutSession', { url: session.url, reference: session.sessionId });
        }

        console.log('\n  🔗  Open this URL to complete a test payment:');
        console.log(`      ${session.url}`);
        console.log('\n  💳  Paystack test cards:');
        console.log('      Card: 4084 0840 8408 4081  |  CVV: any  |  Expiry: any future date');
        console.log('      Card: 5078 5078 5078 5078 12  |  PIN: 111111  |  OTP: 123456');
    } catch (err: any) {
        fail('createCheckoutSession', err);
    }
}

// ─── Step 4: verifyWebhookSignature ─────────────────────────────────────────

async function testWebhookSignature(adapter: PaystackAdapter): Promise<void> {
    heading('Step 4 – verifyWebhookSignature');

    const payload = JSON.stringify({ event: 'charge.success', data: { status: 'success' } });

    // Valid signature (computed the same way Paystack does)
    const validSig = crypto.createHmac('sha512', SECRET_KEY).update(payload).digest('hex');
    const resultValid = adapter.verifyWebhookSignature(payload, validSig);
    if (resultValid) {
        pass('Valid signature accepted');
    } else {
        fail('Valid signature accepted', new Error('Expected true, got false'));
    }

    // Invalid signature
    const resultInvalid = adapter.verifyWebhookSignature(payload, 'deadbeef_invalid');
    if (!resultInvalid) {
        pass('Invalid signature rejected');
    } else {
        fail('Invalid signature rejected', new Error('Expected false, got true'));
    }
}

// ─── Step 5: parseWebhookEvent ──────────────────────────────────────────────

async function testParseWebhookEvent(adapter: PaystackAdapter): Promise<void> {
    heading('Step 5 – parseWebhookEvent');

    const fakeOrganizationId = 'org_test_abc';

    // ── charge.success ──
    const chargePayload = {
        event: 'charge.success',
        data: {
            status: 'success',
            reference: 'ref_abcdef',
            subscription_code: 'SUB_xyz123',
            customer: { customer_code: 'CUS_testcustomer', email: 'test@hylius.dev' },
            next_payment_date: '2026-03-22T00:00:00.000Z',
            metadata: {
                custom_fields: [{ variable_name: 'organizationId', value: fakeOrganizationId }]
            }
        }
    };

    const chargeEvent = adapter.parseWebhookEvent(chargePayload);
    if (
        chargeEvent.isSubscriptionChange &&
        chargeEvent.status === 'ACTIVE' &&
        chargeEvent.organizationId === fakeOrganizationId &&
        chargeEvent.customerId === 'CUS_testcustomer'
    ) {
        pass('charge.success parsed correctly', chargeEvent);
    } else {
        fail('charge.success parsed correctly', new Error(JSON.stringify(chargeEvent)));
    }

    // ── subscription.disable ──
    const cancelPayload = {
        event: 'subscription.disable',
        data: {
            status: 'cancelled',
            subscription_code: 'SUB_xyz123',
            customer: { customer_code: 'CUS_testcustomer', email: 'test@hylius.dev' },
            metadata: {}
        }
    };

    const cancelEvent = adapter.parseWebhookEvent(cancelPayload);
    if (cancelEvent.isSubscriptionChange && cancelEvent.status === 'CANCELED') {
        pass('subscription.disable parsed correctly', { status: cancelEvent.status });
    } else {
        fail('subscription.disable parsed correctly', new Error(JSON.stringify(cancelEvent)));
    }

    // ── unknown event (should be ignored) ──
    const unknownPayload = { event: 'transfer.success', data: {} };
    const unknownEvent = adapter.parseWebhookEvent(unknownPayload);
    if (!unknownEvent.isSubscriptionChange) {
        pass('Unknown event correctly ignored');
    } else {
        fail('Unknown event correctly ignored', new Error('Expected isSubscriptionChange=false'));
    }
}

// ─── Step 6: Test Local Webhook Delivery ───────────────────────────────────

async function testLocalWebhookDelivery(): Promise<void> {
    heading('Step 6 – Local Webhook Delivery');
    console.log('  📡  Sending mock charge.success to http://127.0.0.1:3000/api/webhooks/paystack...');

    const payload = JSON.stringify({
        event: 'charge.success',
        data: {
            status: 'success',
            amount: 200000,
            currency: 'NGN',
            reference: `test_ref_${Date.now()}`,
            subscription_code: `test_sub_${Date.now()}`,
            customer: { customer_code: 'CUS_test_local', email: 'test-local@hylius.dev' },
            metadata: {
                custom_fields: [{ variable_name: 'organizationId', value: 'cmluz0qtz0001jw' }]
            }
        }
    });

    const signature = crypto.createHmac('sha512', SECRET_KEY).update(payload).digest('hex');

    try {
        const res = await fetch('http://127.0.0.1:3000/api/webhooks/paystack', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-paystack-signature': signature
            },
            body: payload
        });

        const data = await res.json();
        if (res.ok && data.received) {
            pass('Webhook delivered and acknowledged by server');
        } else {
            fail('Webhook delivery', new Error(`Server responded with ${res.status}: ${JSON.stringify(data)}`));
        }
    } catch (err: any) {
        fail('Webhook delivery', new Error(`Could not connect to server. Is it running at localhost:3000?\n      ${err.message}`));
    }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    console.log('\n🧪  Paystack Integration Test Suite');
    console.log(`    Testing against: ${BASE_URL}`);
    console.log(`    Key: ${SECRET_KEY.substring(0, 12)}...`);

    const adapter = new PaystackAdapter();

    try {
        // Step 1: Create real plan (needed for checkout test)
        const planCode = await createTestPlan();

        // Step 2: Customer
        const customerId = await testCreateCustomer(adapter);

        // Step 3: Checkout Session
        await testCreateCheckoutSession(adapter, customerId, planCode);
    } catch (err: any) {
        console.error('\n⚠️   Fatal error in live API steps:', err.message);
        console.error('    Continuing with offline tests...\n');
    }

    // Steps 4, 5 & 6 don't need a live API call to Paystack
    await testWebhookSignature(adapter);
    await testParseWebhookEvent(adapter);
    await testLocalWebhookDelivery();

    // ── Summary ──────────────────────────────────────────────────────────────
    const total = passed + failed;
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  Results: ${passed}/${total} passed${failed > 0 ? `  (${failed} failed)` : ''}`);
    if (failed === 0) {
        console.log('  🎉  All tests passed!');
    } else {
        console.log('  ⚠️   Some tests failed — review the output above.');
        process.exit(1);
    }
    console.log(`${'═'.repeat(60)}\n`);
}

main().catch((err) => {
    console.error('\n💥  Unexpected error:', err);
    process.exit(1);
});
