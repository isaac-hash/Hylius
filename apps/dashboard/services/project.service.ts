import { prisma } from './prisma';
import { decrypt } from './crypto.service';
// @ts-ignore - Local workspace package
import { SSHClient, ServerConfig } from '@hylius/core';

export async function deleteProject(projectId: string, organizationId: string): Promise<void> {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { server: true }
    });

    if (!project || project.organizationId !== organizationId) {
        throw new Error('Project not found');
    }

    // --- PM2 Teardown: SSH into the VPS and clean up ---
    try {
        let privateKey = '';
        if (project.server.privateKeyEncrypted && project.server.keyIv) {
            privateKey = decrypt(project.server.privateKeyEncrypted, project.server.keyIv);
        }

        const serverConfig: ServerConfig = {
            host: project.server.ip,
            port: project.server.port,
            username: project.server.username,
            privateKey: privateKey.includes('BEGIN') ? privateKey : undefined,
            password: privateKey && !privateKey.includes('BEGIN') ? privateKey : undefined,
        };

        const client = new SSHClient(serverConfig);
        await client.connect();

        const deployPath = project.deployPath || `/var/www/${project.name}`;
        
        // Use containerName if provided, otherwise fallback to safeName from project name
        const containerName = project.containerName || project.name.toLowerCase().replace(/[^a-z0-9]/g, '-');

        // Tear down based on deploy strategy
        const strategy = project.deployStrategy || 'compose';

        if (strategy === 'compose' || strategy === 'docker_compose' || strategy === 'compose-server' || strategy === 'compose-registry') {
            // Stop compose stack by container/project name
            await client.exec(`docker compose -p "${containerName}" down --remove-orphans 2>/dev/null || true`);
            // Also stop any standalone containers with project name pattern
            await client.exec(`docker ps -q --filter name="${containerName}" | xargs -r docker stop 2>/dev/null || true`);
            await client.exec(`docker ps -aq --filter name="${containerName}" | xargs -r docker rm 2>/dev/null || true`);
        } else if (strategy === 'docker' || strategy === 'ghcr-pull' || strategy === 'dagger') {
            await client.exec(`docker stop "${containerName}" 2>/dev/null || true`);
            await client.exec(`docker stop "${containerName}-app" 2>/dev/null || true`);
            await client.exec(`docker rm "${containerName}" 2>/dev/null || true`);
            await client.exec(`docker rm "${containerName}-app" 2>/dev/null || true`);
        } else {
            // PM2 fallback
            await client.exec(`pm2 delete "${project.name}" 2>/dev/null || true`);
        }

        // Remove deploy files
        await client.exec(`rm -rf ${deployPath}`);

        client.end();
    } catch (sshError: any) {
        // Server may be offline — log but don't block DB deletion
        console.warn(`Teardown failed for project ${project.name}: ${sshError.message}`);
    }

    // --- Database cleanup ---
    await prisma.deployment.deleteMany({
        where: { projectId }
    });

    await prisma.project.delete({
        where: { id: projectId }
    });
}
