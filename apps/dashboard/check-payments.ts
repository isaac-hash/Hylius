import { prisma } from './services/prisma';

async function main() {
    const payments = await prisma.payment.findMany();
    console.log('--- PAYMENTS ---');
    console.log(JSON.stringify(payments, null, 2));

    const subs = await prisma.subscription.findMany();
    console.log('--- SUBSCRIPTIONS ---');
    console.log(JSON.stringify(subs, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
