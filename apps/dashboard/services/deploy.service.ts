/* eslint-disable no-console, @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';
// @ts-ignore - Local workspace package
import { deploy, DeployOptions, ServerConfig, ProjectConfig, DeployResult } from '@hylius/core';
import { decrypt } from './crypto.service';
import { getAuthenticatedCloneUrl, createGitHubDeployment, updateGitHubDeploymentStatus, createPullRequestComment } from './github.service';

import { prisma } from './prisma';

export interface DeployServiceOptions {
    projectId: string;
    trigger: 'dashboard' | 'webhook' | 'cli';
    prNumber?: number;
    commitSha?: string;
    /** Optional callback for real-time log streaming (e.g. socket.emit) */
    onLog?: (chunk: string) => void;
}

/**
 * Execute a full deployment for a project.
 * This is the single source of truth for the deploy pipeline — called by
 * both the Socket.io handler (dashboard) and the GitHub webhook endpoint.
 */
export async function executeDeployment(options: DeployServiceOptions): Promise<DeployResult & { deploymentId: string }> {
    const { projectId, trigger, prNumber, onLog } = options;
    const isPreview = !!prNumber;
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
            environment: isPreview ? 'PREVIEW' : 'PRODUCTION',
            pullRequestNumber: prNumber || null,
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

    let envVars: Record<string, string> | undefined = undefined;
    if (project.envVars) {
        try {
            envVars = JSON.parse(project.envVars as string);
        } catch (e: any) {
            log(`Warning: Failed to parse project envVars: ${e.message}\n`);
        }
    }

    const projectConfig: ProjectConfig = {
        name: project.name,
        repoUrl,
        branch: project.branch,
        deployPath: project.deployPath,
        buildCommand: project.buildCommand || undefined,
        startCommand: project.startCommand || undefined,
        // 'dagger' strategy produces a GHCR image just like 'ghcr-pull' — VPS behavior is identical
        deployStrategy: (project.deployStrategy === 'dagger' ? 'ghcr-pull' : project.deployStrategy as any) || 'auto',
        ghcrImage: project.ghcrImage || undefined,
        env: envVars || {},
        environment: isPreview ? 'PREVIEW' : 'PRODUCTION',
        previewId: isPreview ? `pr-${prNumber}` : undefined,
    };
    
    // Auto-inject URL environment variables
    const serverIpSlug = project.server.ip.replace(/\./g, '-');
    if (isPreview) {
        const previewHostname = `pr-${prNumber}.${serverIpSlug}.sslip.io`;
        // For previews, we definitively know the exact URL
        projectConfig.env!['APP_URL'] = `https://${previewHostname}`;
        projectConfig.env!['NEXT_PUBLIC_APP_URL'] = `https://${previewHostname}`;
        projectConfig.env!['ASSET_URL'] = `https://${previewHostname}`;
        projectConfig.env!['HTTPS'] = 'on';
    } else if (project.domains.length > 0) {
        // For production, inject the primary domain if one exists and user hasn't hardcoded it
        if (!projectConfig.env!['APP_URL']) projectConfig.env!['APP_URL'] = `https://${project.domains[0].hostname}`;
        if (!projectConfig.env!['NEXT_PUBLIC_APP_URL']) projectConfig.env!['NEXT_PUBLIC_APP_URL'] = `https://${project.domains[0].hostname}`;
        if (!projectConfig.env!['ASSET_URL']) projectConfig.env!['ASSET_URL'] = `https://${project.domains[0].hostname}`;
        projectConfig.env!['HTTPS'] = 'on';
    }

    // Fetch all active deployments to build the full Caddy proxy list (Production + Previews)
    const activeDeployments = await prisma.deployment.findMany({
        where: {
            projectId: project.id,
            status: 'SUCCESS',
        },
        orderBy: { startedAt: 'desc' }
    });

    const domainConfigs: any[] = [];
    
    // 1. Add Production Domains (if they exist)
    if (project.domains.length > 0) {
        // Find the latest production deployment port
        const latestProd = activeDeployments.find((d: any) => d.environment === 'PRODUCTION');
        let prodPort = '3000';
        if (latestProd?.deployUrl) {
            try { prodPort = new URL(latestProd.deployUrl).port || '3000'; } catch {}
        }
        // Wait, the orchestrator naturally infers the appPort if we just pass `{ hostname: d.hostname }`
        // BUT if we are currently deploying a PREVIEW, the orchestrator's `appPort` belongs to the PREVIEW!
        // So we MUST explicitly lock the Production domains to their existing port (prodPort)!!
        project.domains.forEach((d: any) => {
            domainConfigs.push({ hostname: d.hostname, upstreamPort: isPreview ? prodPort : undefined });
        });
    }

    // 2. Add Active Preview Domains
    const activePreviews = activeDeployments.filter((d: any) => d.environment === 'PREVIEW' && d.pullRequestNumber);
    
    // Add previously built previews
    activePreviews.forEach((d: any) => {
        // Skip the one we are currently building, as it gets added natively below
        if (d.pullRequestNumber === prNumber) return;
        
        const previewHostname = `pr-${d.pullRequestNumber}.${serverIpSlug}.sslip.io`;
        let prePort = '3000';
        if (d.deployUrl) {
            try { prePort = new URL(d.deployUrl).port || '3000'; } catch {}
        }
        domainConfigs.push({ hostname: previewHostname, upstreamPort: prePort });
    });

    // 3. Add the current deployment's domain
    if (isPreview) {
        // Pseudo-subdomain for the current preview deployment
        const previewHostname = `pr-${prNumber}.${serverIpSlug}.sslip.io`;
        // Unshift ensures this is the PRIMARY domain orchestrator returns as the finalURL!
        domainConfigs.unshift({ hostname: previewHostname }); 
        log(`\\n\\x1b[35m[Preview] Automatically provisioning custom pseudodomain: ${previewHostname}\\x1b[0m\\n`);
    }

    // GitHub Deployments Integration: Create deployment and set to in_progress
    let githubDeploymentId: number | null = null;
    const isGithubApp = !!(project.githubInstallationId && project.githubRepoFullName);

    if (isGithubApp) {
        log(`[GitHub] Creating deployment status...\n`);
        githubDeploymentId = await createGitHubDeployment({
            installationId: project.githubInstallationId!,
            repoFullName: project.githubRepoFullName!,
            ref: options.commitSha || project.branch || 'main',
            description: `Deployed via Hylius (${trigger})`,
            environment: isPreview ? `Preview (PR #${prNumber})` : 'Production',
        });

        if (githubDeploymentId) {
            await updateGitHubDeploymentStatus({
                installationId: project.githubInstallationId!,
                repoFullName: project.githubRepoFullName!,
                deploymentId: githubDeploymentId,
                state: 'in_progress',
                description: 'Build and deployment in progress...',
            });
        }
    }

    // 4. Execute Deployment
    log(`\x1b[36mStarting deployment for ${project.name}...  (trigger: ${trigger})\x1b[0m\n`);

    const result = await deploy({
        server: serverConfig,
        project: projectConfig,
        trigger,
        domains: domainConfigs,
        onLog: (chunk) => log(chunk),
    });

    // Update GitHub Deployment Status
    if (isGithubApp && githubDeploymentId) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || '';
        await updateGitHubDeploymentStatus({
            installationId: project.githubInstallationId!,
            repoFullName: project.githubRepoFullName!,
            deploymentId: githubDeploymentId,
            state: result.success ? 'success' : 'failure',
            environmentUrl: result.url || undefined,
            logUrl: baseUrl ? `${baseUrl}` : undefined,
            description: result.success ? 'Deployment successful' : 'Deployment failed',
        });

        // For Previews: Leave a comment on the PR with the Preview URL
        if (result.success && isPreview && prNumber && result.url) {
            log(`[GitHub] Posting preview URL comment to PR #${prNumber}...\\n`);
            await createPullRequestComment({
                installationId: project.githubInstallationId!,
                repoFullName: project.githubRepoFullName!,
                prNumber,
                body: `## 🚀 Preview Deployment Ready!\n\nYour preview environment has been successfully provisioned:\n\n🔗 **Preview URL**: [${result.url}](${result.url})\n\n> _Deployed by Hylius_`
            });
        }
    }

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

/**
 * Destroy an active Preview Deployment container and remove its Caddy proxy records
 */
export async function destroyPreviewDeployment(projectId: string, prNumber: number): Promise<boolean> {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { server: true, domains: true }
    });

    if (!project) throw new Error('Project not found');

    let privateKey = '';
    if (project.server.privateKeyEncrypted && project.server.keyIv) {
        try { privateKey = decrypt(project.server.privateKeyEncrypted, project.server.keyIv); } catch {}
    }

    const { SSHClient, configureCaddy } = require('@hylius/core');
    
    const serverConfig = {
        host: project.server.ip,
        port: project.server.port,
        username: project.server.username,
        privateKey: privateKey.includes('BEGIN') ? privateKey : undefined,
        password: privateKey && !privateKey.includes('BEGIN') ? privateKey : undefined,
    };

    const previewId = `pr-${prNumber}`;
    const baseContainerName = `${project.name}-app`;
    const containerName = `${baseContainerName}-${previewId}`;
    const environmentPath = `${project.deployPath}/previews/${previewId}`;

    const client = new SSHClient(serverConfig);
    try {
        await client.connect();
        
        // 1. Kill and remove the container running the preview build
        await client.exec(`docker rm -f ${containerName} > /dev/null 2>&1 || true`);
        
        // 2. Remove the preview directory
        await client.exec(`rm -rf ${environmentPath} > /dev/null 2>&1 || true`);

        // 3. Update Caddy to remove this preview domain but keep production + other active previews
        const activeDeployments = await prisma.deployment.findMany({
            where: {
                projectId: project.id,
                status: 'SUCCESS',
            },
            orderBy: { startedAt: 'desc' }
        });

        const domainConfigs: any[] = [];
        
        // Add Production Domains
        if (project.domains.length > 0) {
            const latestProd = activeDeployments.find((d: any) => d.environment === 'PRODUCTION');
            let prodPort = '3000';
            if (latestProd?.deployUrl) {
                try { prodPort = new URL(latestProd.deployUrl).port || '3000'; } catch {}
            }
            project.domains.forEach((d: any) => {
                domainConfigs.push({ hostname: d.hostname, upstreamPort: prodPort });
            });
        }

        // Add OTHER Active Preview Domains (exluding the one we are destroying)
        const activePreviews = activeDeployments.filter((d: any) => d.environment === 'PREVIEW' && d.pullRequestNumber && d.pullRequestNumber !== prNumber);
        const serverIpSlug = project.server.ip.replace(/\./g, '-');
        
        activePreviews.forEach((d: any) => {
            const previewHostname = `pr-${d.pullRequestNumber}.${serverIpSlug}.sslip.io`;
            let prePort = '3000';
            if (d.deployUrl) {
                try { prePort = new URL(d.deployUrl).port || '3000'; } catch {}
            }
            domainConfigs.push({ hostname: previewHostname, upstreamPort: prePort });
        });

        if (domainConfigs.length > 0) {
            await configureCaddy(client, { domains: domainConfigs, tlsMode: 'production' });
        } else {
            // If no domains left, just pass empty array to clear the file
            await configureCaddy(client, { domains: [], tlsMode: 'production' });
        }

        // 4. Mark DB deployments as destroyed
        await prisma.deployment.updateMany({
            where: {
                projectId: project.id,
                environment: 'PREVIEW',
                pullRequestNumber: prNumber
            },
            data: { status: 'DESTROYED' }
        });

        return true;
    } catch (err: any) {
        console.error(`Error destroying preview deployment ${previewId}:`, err);
        throw err;
    } finally {
        client.end();
    }
}
