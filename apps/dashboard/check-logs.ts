import { prisma } from './services/prisma';

async function main() {
    const logs = await prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10
    });
    console.log('--- RECENT AUDIT LOGS ---');
    console.log(JSON.stringify(logs, null, 2));

    const subs = await prisma.subscription.findMany();
    console.log('--- SUBSCRIPTIONS ---');
    console.log(JSON.stringify(subs, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
