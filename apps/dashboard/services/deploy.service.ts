/* eslint-disable no-console, @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
// @ts-ignore - Local workspace package
import { deploy, DeployOptions, ServerConfig, ProjectConfig, DeployResult } from '@hylius/core';
import { decrypt } from './crypto.service';
import { getAuthenticatedCloneUrl } from './github.service';

import { prisma } from './prisma';

export interface DeployServiceOptions {
    projectId: string;
    trigger: 'dashboard' | 'webhook' | 'cli';
    /** Optional callback for real-time log streaming (e.g. socket.emit) */
    onLog?: (chunk: string) => void;
}

/**
 * Execute a full deployment for a project.
 * This is the single source of truth for the deploy pipeline — called by
 * both the Socket.io handler (dashboard) and the GitHub webhook endpoint.
 */
export async function executeDeployment(options: DeployServiceOptions): Promise<DeployResult & { deploymentId: string }> {
    const { projectId, trigger, onLog } = options;
    const log = (msg: string) => { if (onLog) onLog(msg); };

    // 1. Fetch Project & Server Config
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { server: true, domains: true },
    });

    if (!project) {
        throw new Error('Project not found');
    }

    // 2. Create Deployment Record
    // @ts-ignore
    const deployment = await prisma.deployment.create({
        data: {
            projectId: project.id,
            organizationId: project.organizationId,
            status: 'PENDING',
            triggerSource: trigger.toUpperCase(),
            releaseId: 'pending',
        },
    });

    // Audit Log
    await prisma.auditLog.create({
        data: {
            action: 'DEPLOYMENT_STARTED',
            organizationId: project.organizationId,
            metadata: JSON.stringify({
                projectId: project.id,
                deploymentId: deployment.id,
                trigger,
            }),
        },
    });

    // 3. Prepare Core Config — Decrypt SSH key in-memory
    let privateKey = '';
    if (project.server.privateKeyEncrypted && project.server.keyIv) {
        try {
            privateKey = decrypt(project.server.privateKeyEncrypted, project.server.keyIv);
        } catch (e) {
            log(`Error decrypting SSH key: ${e}\n`);
        }
    }

    const serverConfig: ServerConfig = {
        // @ts-ignore
        host: project.server.ip,
        port: project.server.port,
        username: project.server.username,
        privateKey: privateKey.includes('BEGIN') ? privateKey : undefined,
        password: privateKey && !privateKey.includes('BEGIN') ? privateKey : undefined,
    };

    // Determine repo URL — use authenticated clone URL for GitHub App repos
    let repoUrl = project.repoUrl;
    if (project.githubInstallationId && project.githubRepoFullName) {
        try {
            repoUrl = await getAuthenticatedCloneUrl(
                project.githubInstallationId,
                project.githubRepoFullName,
            );
            log(`Using GitHub App authenticated clone URL\n`);
        } catch (e: any) {
            log(`Warning: Could not get authenticated clone URL, falling back to repoUrl: ${e.message}\n`);
        }
    }

    const projectConfig: ProjectConfig = {
        name: project.name,
        repoUrl,
        branch: project.branch,
        deployPath: project.deployPath,
        buildCommand: project.buildCommand || undefined,
        startCommand: project.startCommand || undefined,
        deployStrategy: (project.deployStrategy as any) || 'auto',
        ghcrImage: project.ghcrImage || undefined,
    };

    // Build domain configs if domains exist
    const domainConfigs = project.domains.length > 0
        ? project.domains.map((d: any) => ({ hostname: d.hostname, upstreamPort: '3000' }))
        : undefined;

    // 4. Execute Deployment
    log(`\x1b[36mStarting deployment for ${project.name}...  (trigger: ${trigger})\x1b[0m\n`);

    const result = await deploy({
        server: serverConfig,
        project: projectConfig,
        trigger,
        domains: domainConfigs,
        onLog: (chunk) => log(chunk),
    });

    // 5. Update Status
    // @ts-ignore
    await prisma.deployment.update({
        where: { id: deployment.id },
        data: {
            status: result.success ? 'SUCCESS' : 'FAILED',
            releaseId: result.releaseId,
            durationMs: result.durationMs,
            commitHash: result.commitHash,
            deployUrl: result.url || null,
            finishedAt: new Date(),
        },
    });

    // Audit Log Completion
    await prisma.auditLog.create({
        data: {
            action: result.success ? 'DEPLOYMENT_COMPLETED' : 'DEPLOYMENT_FAILED',
            organizationId: project.organizationId,
            metadata: JSON.stringify({
                projectId: project.id,
                deploymentId: deployment.id,
                releaseId: result.releaseId,
                trigger,
                error: result.error,
            }),
        },
    });

    return { ...result, deploymentId: deployment.id };
}
