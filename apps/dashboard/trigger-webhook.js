const crypto = require('crypto');

const SECRET_KEY = 'sk_test_b2dc57e3bdb7ce7837caa38d4414fee46de6e5b3';

async function send() {
    const payload = JSON.stringify({
        event: 'charge.success',
        data: {
            status: 'success',
            amount: 200000,
            currency: 'NGN',
            reference: 'manual_test_' + Date.now(),
            subscription_code: 'SUB_manual_' + Date.now(),
            customer: { customer_code: 'CUS_manual', email: 'manual@hylius.dev' },
            metadata: {
                custom_fields: [{ variable_name: 'organizationId', value: 'cmluz0qtz0001jw' }]
            }
        }
    });

    const signature = crypto.createHmac('sha512', SECRET_KEY).update(payload).digest('hex');

    const res = await fetch('http://127.0.0.1:3000/api/webhooks/paystack', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-paystack-signature': signature
        },
        body: payload
    });

    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', data);
}

send().catch(console.error);
