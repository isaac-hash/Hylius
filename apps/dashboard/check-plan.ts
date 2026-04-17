import { prisma } from './services/prisma';

async function main() {
    console.log('--- DB Check ---');
    const orgs = await prisma.organization.findMany({
        include: { subscriptions: true }
    });
    console.log(JSON.stringify(orgs, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
