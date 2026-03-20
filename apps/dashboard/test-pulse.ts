import { prisma } from './services/prisma';
import { getPulse, ServerConfig } from '@hylius/core';
import { decrypt } from './services/crypto.service';

async function testPulse() {
    try {
        const server = await prisma.server.findFirst({ where: { ip: '127.0.0.1' } });
        if (!server) return console.log("Mock VPS not found in DB");

        const privateKey = decrypt(server.privateKeyEncrypted!, server.keyIv!);
        const config: ServerConfig = {
            host: server.ip,
            port: server.port,
            username: server.username,
            privateKey
        };
        const pulse = await getPulse(config);
        console.log("Success:", pulse);
    } catch (e: any) {
        console.error("Failed:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}
testPulse();
