import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
    const orgs = await p.organization.findMany({ select: { id: true, name: true, plan: true } });
    console.log('ORGS:', JSON.stringify(orgs, null, 2));

    const subs = await p.subscription.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
    console.log('SUBS:', JSON.stringify(subs, null, 2));

    await p.$disconnect();
}

main();
