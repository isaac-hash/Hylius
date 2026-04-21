import { NextResponse } from 'next/server';
import { prisma } from '../../../../services/prisma';
import { requireAuth } from '../../../../services/auth.service';
import { decrypt } from '../../../../services/crypto.service';
// @ts-ignore - Local workspace package
import { SSHClient, ServerConfig } from '@hylius/core';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });

        const params = await context.params;
        const projectId = params.id;

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { server: true }
        });

        if (!project || project.organizationId !== auth.organizationId) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
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
            const safeName = project.name.toLowerCase().replace(/[^a-z0-9]/g, '-');

            // Tear down based on deploy strategy
            const strategy = project.deployStrategy || 'compose';

            if (strategy === 'compose' || strategy === 'docker_compose') {
                // Stop compose stack by project name
                await client.exec(`docker compose -p "${safeName}" down --remove-orphans 2>/dev/null || true`);
                // Also stop any standalone containers with project name pattern
                await client.exec(`docker ps -q --filter name="${safeName}" | xargs -r docker stop 2>/dev/null || true`);
                await client.exec(`docker ps -aq --filter name="${safeName}" | xargs -r docker rm 2>/dev/null || true`);
            } else if (strategy === 'docker') {
                await client.exec(`docker stop "${safeName}-app" 2>/dev/null || true`);
                await client.exec(`docker rm "${safeName}-app" 2>/dev/null || true`);
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

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed to delete project' }, { status: 500 });
    }
}
