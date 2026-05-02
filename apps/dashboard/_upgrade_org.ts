import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
    // Upgrade the org to PRO
    const updated = await p.organization.update({
        where: { id: 'cmon72u0m00012tqzch1eti6k' },
        data: { plan: 'PRO' },
    });
    console.log('Updated org:', updated.name, '→', updated.plan);

    // Also fix the latest subscription to ACTIVE
    const sub = await p.subscription.updateMany({
        where: { organizationId: 'cmon72u0m00012tqzch1eti6k', status: 'INCOMPLETE' },
        data: { status: 'ACTIVE' },
    });
    console.log('Activated subscriptions:', sub.count);

    await p.$disconnect();
}

main();
