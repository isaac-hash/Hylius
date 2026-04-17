import { prisma } from './services/prisma';

async function main() {
    console.log('Upgrading organizations to PRO...');
    const result = await prisma.organization.updateMany({
        where: { plan: 'FREE' },
        data: { plan: 'PRO' }
    });
    console.log(`Upgraded ${result.count} organizations to PRO.`);
}

main().catch(console.error).finally(() => process.exit(0));
