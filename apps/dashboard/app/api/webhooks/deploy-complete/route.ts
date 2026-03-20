import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '../../../../services/prisma';
import { executeDeployment } from '../../../../services/deploy.service';

/**
 * Handle POST /api/webhooks/deploy-complete
 * 
 * Called by GitHub Actions after successfully pushing an image to GHCR.
 * Triggers a deployment on the VPS configured for the project.
 */
export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
        }

        const tokenString = authHeader.substring(7);
        const hashedToken = crypto.createHash('sha256').update(tokenString).digest('hex');

        // 1. Verify ApiToken
        const apiToken = await prisma.apiToken.findUnique({
            where: { hashedToken },
            include: { organization: true }
        });

        if (!apiToken) {
            return NextResponse.json({ error: 'Invalid API Token' }, { status: 401 });
        }

        // Update lastUsedAt
        await prisma.apiToken.update({
            where: { id: apiToken.id },
            data: { lastUsedAt: new Date() }
        });

        const body = await request.json();
        const { image, sha, repo, ref, compose } = body;

        if (!repo) {
            return NextResponse.json({ error: 'Missing required field: repo' }, { status: 400 });
        }
        if (!compose && !image) {
            return NextResponse.json({ error: 'Missing required field: image' }, { status: 400 });
        }

        // 2. Find matching project for this repo
        // E.g. repo = "isaac-hash/stark-inspect-terminal"
        const projects = await prisma.project.findMany({
            where: {
                organizationId: apiToken.organizationId,
                githubRepoFullName: repo
            }
        });

        if (projects.length === 0) {
            console.log(`[Deploy Webhook] No projects found for repo: ${repo}`);
            return NextResponse.json({ message: 'No projects found for this repository' });
        }

        // 3. Filter projects by branch (ref) if provided, otherwise deploy all
        let targetProjects = projects;
        if (ref) {
            // ref from GitHub Actions is usually like "refs/heads/main" or just "main"
            const branchName = ref.replace('refs/heads/', '');
            targetProjects = projects.filter((p: any) => !p.branch || p.branch === branchName);
        }

        if (targetProjects.length === 0) {
            console.log(`[Deploy Webhook] No projects found for branch: ${ref}`);
            return NextResponse.json({ message: 'No projects match this branch' });
        }

        // 4. Trigger deployments
        const deployStats = [];
        for (const project of targetProjects) {
            if (compose) {
                if (project.deployStrategy !== 'compose-registry') {
                    console.log(`[Deploy Webhook] Skipping ${project.name} because deployStrategy is ${project.deployStrategy} (expected compose-registry)`);
                    deployStats.push({ project: project.name, status: 'skipped (not compose-registry)' });
                    continue;
                }
            } else {
                // Validate that the project is configured for GHCR image pull
                // 'dagger' strategy also produces a GHCR image, so treat it the same as 'ghcr-pull'
                if (project.deployStrategy !== 'ghcr-pull' && project.deployStrategy !== 'dagger') {
                    console.log(`[Deploy Webhook] Skipping ${project.name} because deployStrategy is ${project.deployStrategy}`);
                    deployStats.push({ project: project.name, status: 'skipped (not ghcr-pull or dagger)' });
                    continue;
                }
            }

            console.log(`[Deploy Webhook] Triggering deploy for ${project.name} (${compose ? 'compose' : 'image: ' + image})`);

            if (!compose) {
                // Update the project with the specific image tag for this deployment
                await prisma.project.update({
                    where: { id: project.id },
                    data: { ghcrImage: image }
                });
            }

            // Note: fire-and-forget in background since it might take a few seconds
            if ((global as any).io) {
                (global as any).io.emit(`deploy_start:${project.id}`, { deploymentId: 'pending' });
            }

            executeDeployment({
                projectId: project.id,
                trigger: 'webhook',
                onLog: (chunk) => {
                    process.stdout.write(`[Deploy Worker] ${chunk}`);
                    if ((global as any).io) {
                        (global as any).io.emit(`log:${project.id}`, chunk);
                    }
                }
            }).then(result => {
                if ((global as any).io) {
                    if (result.success) {
                        (global as any).io.emit(`deploy_success:${project.id}`, result);
                        (global as any).io.emit(`log:${project.id}`, `\n\x1b[32mDeployment Successful! Release: ${result.releaseId}\x1b[0m\n`);
                    } else {
                        (global as any).io.emit(`deploy_error:${project.id}`, result.error);
                        (global as any).io.emit(`log:${project.id}`, `\n\x1b[31mDeployment Failed: ${result.error}\x1b[0m\n`);
                    }
                }
            }).catch(e => {
                console.error('[Webhook Deploy Task Error]', e);
                if ((global as any).io) {
                    (global as any).io.emit(`error:${project.id}`, e.message);
                    (global as any).io.emit(`log:${project.id}`, `\n\x1b[31mSystem Error: ${e.message}\x1b[0m\n`);
                }
            });

            deployStats.push({ project: project.name, status: 'triggered' });
        }

        return NextResponse.json({ success: true, targets: deployStats });

    } catch (error: any) {
        console.error('[Deploy Webhook] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
