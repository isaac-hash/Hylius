import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function main() {
    // Find all servers that don't have an agentToken yet
    const servers = await prisma.server.findMany({
        where: { agentToken: null },
    });

    console.log(`Found ${servers.length} server(s) without agentToken.`);

    for (const server of servers) {
        const token = `hyl_${randomBytes(32).toString('hex')}`;
        await prisma.server.update({
            where: { id: server.id },
            data: { agentToken: token },
        });
        console.log(`  ✅ ${server.name} (${server.id}) → token generated`);
    }

    console.log('\nDone. Restart your dev server to pick up all changes.');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
