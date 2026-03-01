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

            // Stop and delete the PM2 process
            await client.exec(`pm2 delete "${project.name}" 2>/dev/null || true`);

            // Remove deploy files
            const deployPath = project.deployPath || `/var/www/${project.name}`;
            await client.exec(`rm -rf ${deployPath}`);

            client.end();
        } catch (sshError: any) {
            // Server may be offline — log but don't block DB deletion
            console.warn(`PM2 teardown failed for project ${project.name}: ${sshError.message}`);
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
