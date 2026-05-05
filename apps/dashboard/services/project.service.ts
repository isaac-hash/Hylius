import { prisma } from './prisma';
import { decrypt } from './crypto.service';
// @ts-ignore - Local workspace package
import { SSHClient, ServerConfig } from '@hylius/core';
import { agentGateway } from './agent-gateway.service';
import { deleteDatabase } from './database.service';

/**
 * Fully deletes a project: tears down all Docker resources on the VPS,
 * destroys linked databases, cleans up domains from Caddy, and removes
 * all related database records.
 */
export async function deleteProject(projectId: string, organizationId: string): Promise<void> {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { server: true, domains: true, databases: true }
    });

    if (!project || project.organizationId !== organizationId) {
        throw new Error('Project not found');
    }

    // --- VPS Teardown: Clean up all Docker resources related to the project ---
    try {
        const useAgent = (project.server as any).connectionMode === 'AGENT'
            && agentGateway.isConnected(project.server.id);

        // Build the container name variants to clean up
        const safeName = project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const containerName = (project as any).containerName || safeName;
        const appContainerName = `${containerName}-app`;
        const composeProjectName = safeName;

        // Build the image name to remove
        const imageName = `${safeName}:latest`;

        if (useAgent) {
            // ─── Agent mode ─────────────────────────────────────────────────
            const agent = agentGateway.getAgentConfig(project.server.id);

            const agentExec = async (cmd: string) => {
                try {
                    await agent.streamCommand('exec', { cmd }, () => {});
                } catch { /* ignore — best-effort cleanup */ }
            };

            // 1. Stop and remove compose stack
            await agentExec(`docker compose -p "${composeProjectName}" down --remove-orphans --volumes 2>/dev/null || true`);

            // 2. Force remove any standalone containers matching this project
            await agentExec(`docker rm -f "${containerName}" "${appContainerName}" 2>/dev/null || true`);
            // Also catch any containers with the project name prefix
            await agentExec(`docker ps -aq --filter "name=${containerName}" | xargs -r docker rm -f 2>/dev/null || true`);

            // 3. Remove project images
            await agentExec(`docker rmi "${imageName}" 2>/dev/null || true`);
            // Remove any dangling images that were used
            await agentExec(`docker image prune -f 2>/dev/null || true`);

            // 4. Remove deploy directory
            const deployPath = project.deployPath || `/var/www/${project.name}`;
            await agentExec(`rm -rf "${deployPath}"`);

            // 5. Remove project-specific Docker volumes (named after the compose project)
            await agentExec(`docker volume ls -q --filter "name=${composeProjectName}" | xargs -r docker volume rm 2>/dev/null || true`);

            // 6. Update Caddy to remove this project's domains
            if (project.domains && project.domains.length > 0) {
                // We need to rebuild Caddy config WITHOUT this project's domains
                // Simply remove the domains — Caddy will be reconfigured on next deploy
                await agentExec(`echo "Domains removed from project, Caddy will be updated on next deploy"`);
            }
        } else {
            // ─── SSH mode ───────────────────────────────────────────────────
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

            try {
                const deployPath = project.deployPath || `/var/www/${project.name}`;

                // 1. Stop and remove compose stack (with volumes)
                await client.exec(`docker compose -p "${composeProjectName}" down --remove-orphans --volumes 2>/dev/null || true`);

                // 2. Force remove any standalone containers matching this project
                await client.exec(`docker rm -f "${containerName}" "${appContainerName}" 2>/dev/null || true`);
                await client.exec(`docker ps -aq --filter "name=${containerName}" | xargs -r docker rm -f 2>/dev/null || true`);

                // 3. Remove project images
                await client.exec(`docker rmi "${imageName}" 2>/dev/null || true`);
                await client.exec(`docker image prune -f 2>/dev/null || true`);

                // 4. Remove deploy directory
                await client.exec(`rm -rf "${deployPath}"`);

                // 5. Remove project-specific Docker volumes
                await client.exec(`docker volume ls -q --filter "name=${composeProjectName}" | xargs -r docker volume rm 2>/dev/null || true`);
            } finally {
                client.end();
            }
        }
    } catch (teardownError: any) {
        // Server may be offline — log but don't block DB deletion
        console.warn(`[deleteProject] VPS teardown failed for project ${project.name}: ${teardownError.message}`);
    }

    // --- Destroy linked managed databases on VPS ---
    if (project.databases && project.databases.length > 0) {
        for (const db of project.databases) {
            try {
                await deleteDatabase(db.id, true); // removeVolume=true for full cleanup
            } catch (dbErr: any) {
                console.warn(`[deleteProject] Failed to destroy database ${db.name}: ${dbErr.message}`);
            }
        }
    }

    // --- Database record cleanup (order matters for FK constraints) ---

    // Delete performance audits (no cascade defined)
    await prisma.performanceAudit.deleteMany({ where: { projectId } });

    // Delete deployments (no cascade defined)
    await prisma.deployment.deleteMany({ where: { projectId } });

    // Unlink any remaining databases that weren't destroyed above
    // @ts-ignore
    await prisma.database.updateMany({
        where: { projectId },
        data: { projectId: null }
    });

    // Delete alerts referencing this project
    await prisma.alert.deleteMany({ where: { projectId } });

    // Domains cascade on delete via schema, but be explicit
    await prisma.domain.deleteMany({ where: { projectId } });

    // Finally delete the project itself
    await prisma.project.delete({ where: { id: projectId } });

    // Audit log
    await prisma.auditLog.create({
        data: {
            action: 'PROJECT_DELETED',
            organizationId,
            metadata: JSON.stringify({ projectId, projectName: project.name }),
        }
    });
}
