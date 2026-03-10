import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const servers = await prisma.server.findMany();
    for (const server of servers) {
        if (server.ip.includes('http://') || server.ip.includes('https://')) {
            const cleanIp = server.ip.replace(/^https?:\/\//, '').split('/')[0];
            await prisma.server.update({
                where: { id: server.id },
                data: { ip: cleanIp }
            });
            console.log(`Cleaned IP for server ${server.name} from ${server.ip} to ${cleanIp}`);
        }
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
