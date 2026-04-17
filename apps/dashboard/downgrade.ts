import { prisma } from './services/prisma';

async function main() {
    console.log('Downgrading organizations to FREE...');
    const result = await prisma.organization.updateMany({
        where: { plan: 'PRO' },
        data: { plan: 'FREE' }
    });
    console.log(`Downgraded ${result.count} organizations to FREE.`);
}

main().catch(console.error).finally(() => process.exit(0));
