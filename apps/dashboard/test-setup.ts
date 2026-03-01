import { PrismaClient } from '@prisma/client';
import { setup } from '@hylius/core';
import { decrypt } from './services/crypto.service';

const prisma = new PrismaClient();

async function main() {
    const project = await prisma.project.findFirst({
        orderBy: { createdAt: 'desc' },
        include: { server: true }
    });

    if (!project) throw new Error('No project found');

    console.log(`Testing setup for server ${project.server.name}`);

    let privateKey = '';
    if (project.server.privateKeyEncrypted && project.server.keyIv) {
        privateKey = decrypt(project.server.privateKeyEncrypted, project.server.keyIv);
    }

    const serverConfig = {
        host: project.server.ip,
        port: project.server.port,
        username: project.server.username,
        privateKey: privateKey.includes('BEGIN') ? privateKey : undefined,
        password: privateKey && !privateKey.includes('BEGIN') ? privateKey : undefined,
    };

    console.log('Running setup...');
    const result = await setup({
        server: serverConfig,
        onLog: (chunk) => process.stdout.write(chunk),
    });

    console.log('\nSetup Result:', result);
    await prisma.$disconnect();
}

main().catch(console.error);
