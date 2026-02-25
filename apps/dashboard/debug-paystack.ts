import dotenv from 'dotenv';
dotenv.config();

const secretKey = process.env.PAYSTACK_SECRET_KEY;

async function testPaystack() {
    console.log('Testing Paystack Key:', secretKey?.substring(0, 8) + '...');
    try {
        const plans = ['PLN_en8enkjza206cme', 'PLN_6ge4tmlh3dew6sw'];

        for (const p of plans) {
            const res = await fetch('https://api.paystack.co/transaction/initialize', {
                method: 'POST',
                headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'test@example.com', plan: p, amount: 10000 })
            });
            const data = await res.json();
            console.log(`Initialize with ${p} Status:`, res.status);
            console.log(`Initialize with ${p} Data:`, JSON.stringify(data, null, 2));
        }

        const res3 = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test@example.com', amount: 10000 })
        });
        const data3 = await res3.json();
        console.log('Initialize without Plan Status:', res3.status);
        console.log('Initialize without Plan Data:', JSON.stringify(data3, null, 2));

    } catch (error) {
        console.error('Fetch error:', error);
    }
}

testPaystack();
