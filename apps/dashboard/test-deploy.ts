import { PrismaClient } from '@prisma/client';
import { deploy } from '@hylius/core';
import { decrypt } from './services/crypto.service';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    console.log('Fetching latest project from DB...');
    const project = await prisma.project.findFirst({
        orderBy: { createdAt: 'desc' },
        include: { server: true }
    });

    if (!project) throw new Error('No project found');

    console.log(`Testing deploy for project: ${project.name} on server ${project.server.name}`);

    let privateKey = '';
    if (project.server.privateKeyEncrypted && project.server.keyIv) {
        privateKey = decrypt(project.server.privateKeyEncrypted, project.server.keyIv);
        console.log('Successfully decrypted private key. Length:', privateKey.length);
        console.log('Does it contain BEGIN OPENSSH PRIVATE KEY?', privateKey.includes('BEGIN OPENSSH PRIVATE KEY') ? 'Yes' : 'No');
        console.log('Is it strictly equal to the file?', privateKey === fs.readFileSync('../../mock_vps_key', 'utf-8').trim() ? 'Yes' : 'No');
    }

    const serverConfig = {
        host: project.server.ip,
        port: project.server.port,
        username: project.server.username,
        privateKey,
    };

    const projectConfig = {
        name: project.name,
        repoUrl: project.repoUrl,
        branch: project.branch,
        deployPath: project.deployPath,
    };

    console.log('Running deploy...');
    const result = await deploy({
        server: serverConfig,
        project: projectConfig,
        trigger: 'cli-test',
        onLog: (chunk) => process.stdout.write(chunk),
    });

    console.log('\nDeploy Result:', result);
    await prisma.$disconnect();
}

main().catch(console.error);
