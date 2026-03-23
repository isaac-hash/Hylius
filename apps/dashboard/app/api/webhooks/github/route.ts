import { NextResponse } from 'next/server';
import { prisma } from '../../../../services/prisma';
import { verifyWebhookSignature } from '../../../../services/github.service';
import { executeDeployment, destroyPreviewDeployment } from '../../../../services/deploy.service';

/**
 * GitHub Webhook Endpoint
 *
 * Handles:
 * - `push` events → auto-deploy matching projects
 * - `installation` events → create/delete GitHubInstallation records
 */
export async function POST(request: Request) {
    const event = request.headers.get('x-github-event') || '';
    const signature = request.headers.get('x-hub-signature-256') || '';
    const payload = await request.text();

    console.log(`[GitHub Webhook] Received event: ${event}`);

    // 1. Verify signature
    if (!verifyWebhookSignature(payload, signature)) {
        console.warn('[GitHub Webhook] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let body: any;
    try {
        body = JSON.parse(payload);
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // 2. Handle events
    try {
        if (event === 'push') {
            return await handlePush(body);
        } else if (event === 'pull_request') {
            return await handlePullRequest(body);
        } else if (event === 'installation') {
            return await handleInstallation(body);
        } else if (event === 'ping') {
            return NextResponse.json({ message: 'pong' });
        }

        // Unhandled event type — acknowledge but do nothing
        return NextResponse.json({ message: `Ignored event: ${event}` });
    } catch (err: any) {
        console.error(`[GitHub Webhook] Error handling ${event}:`, err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ─── Push Event Handler ─────────────────────────────────────

async function handlePush(body: any) {
    const repoFullName: string = body.repository?.full_name;
    const ref: string = body.ref || '';
    const defaultBranch: string = body.repository?.default_branch || 'main';

    if (!repoFullName) {
        return NextResponse.json({ error: 'Missing repository.full_name' }, { status: 400 });
    }

    // Only deploy on pushes to the default branch
    const pushedBranch = ref.replace('refs/heads/', '');
    if (pushedBranch !== defaultBranch) {
        console.log(`[GitHub Webhook] Push to ${pushedBranch}, skipping (not default branch: ${defaultBranch})`);
        return NextResponse.json({ message: `Skipped: push to ${pushedBranch}` });
    }

    // Find all projects linked to this repo
    const projects = await prisma.project.findMany({
        where: { githubRepoFullName: repoFullName },
    });

    if (projects.length === 0) {
        console.log(`[GitHub Webhook] No projects linked to ${repoFullName}`);
        return NextResponse.json({ message: `No projects linked to ${repoFullName}` });
    }

    console.log(`[GitHub Webhook] Deploying ${projects.length} project(s) for ${repoFullName}`);

    // Deploy each matching project
    const results = [];
    for (const project of projects) {
        if (project.deployStrategy === 'ghcr-pull') {
            console.log(`[GitHub Webhook] Skipping ${project.name} because it uses ghcr-pull strategy (handled by deploy-complete webhook)`);
            results.push({ projectId: project.id, name: project.name, skipped: true, reason: 'ghcr-pull strategy' });
            continue;
        }

        try {
            if ((global as any).io) {
                (global as any).io.emit(`deploy_start:${project.id}`, { deploymentId: 'pending' });
            }

            const result = await executeDeployment({
                projectId: project.id,
                trigger: 'webhook',
                onLog: (chunk) => {
                    // Webhook deploys are fire-and-forget — log to console
                    process.stdout.write(`[webhook:${project.name}] ${chunk}`);
                    if ((global as any).io) {
                        (global as any).io.emit(`log:${project.id}`, chunk);
                    }
                },
            });

            if ((global as any).io) {
                if (result.success) {
                    (global as any).io.emit(`deploy_success:${project.id}`, result);
                    (global as any).io.emit(`log:${project.id}`, `\n\x1b[32mDeployment Successful! Release: ${result.releaseId}\x1b[0m\n`);
                } else {
                    (global as any).io.emit(`deploy_error:${project.id}`, result.error);
                    (global as any).io.emit(`log:${project.id}`, `\n\x1b[31mDeployment Failed: ${result.error}\x1b[0m\n`);
                }
            }

            results.push({ projectId: project.id, name: project.name, success: result.success });
        } catch (err: any) {
            console.error(`[GitHub Webhook] Deploy failed for ${project.name}:`, err.message);
            if ((global as any).io) {
                (global as any).io.emit(`error:${project.id}`, err.message);
                (global as any).io.emit(`log:${project.id}`, `\n\x1b[31mSystem Error: ${err.message}\x1b[0m\n`);
            }
            results.push({ projectId: project.id, name: project.name, success: false, error: err.message });
        }
    }

    return NextResponse.json({ deployed: results });
}

// ─── Pull Request Event Handler ───────────────────────────

async function handlePullRequest(body: any) {
    const action = body.action; // "opened", "closed", "synchronize", "reopened"
    if (action !== 'closed') {
        // Preview environment creation is handled by the Action Webhook.
        // We only care about destroying it when the PR is closed or merged.
        return NextResponse.json({ message: `Ignored PR action: ${action}` });
    }

    const repoFullName: string = body.repository?.full_name;
    const prNumber: number = body.pull_request?.number;

    if (!repoFullName || !prNumber) {
        return NextResponse.json({ error: 'Missing repository or PR number' }, { status: 400 });
    }

    const projects = await prisma.project.findMany({
        where: { githubRepoFullName: repoFullName },
    });

    if (projects.length === 0) {
        return NextResponse.json({ message: `No projects linked to ${repoFullName}` });
    }

    console.log(`[GitHub Webhook] PR #${prNumber} closed for ${repoFullName}. Triggering preview cleanup...`);

    const results = [];
    for (const project of projects) {
        try {
            await destroyPreviewDeployment(project.id, prNumber);
            results.push({ projectId: project.id, name: project.name, success: true });
        } catch (err: any) {
            console.error(`[GitHub Webhook] Cleanup failed for ${project.name}:`, err.message);
            results.push({ projectId: project.id, name: project.name, success: false, error: err.message });
        }
    }

    return NextResponse.json({ cleanup: results });
}

// ─── Installation Event Handler ─────────────────────────────

async function handleInstallation(body: any) {
    const action: string = body.action;
    const installationId: number = body.installation?.id;
    const accountLogin: string = body.installation?.account?.login || '';
    const accountType: string = body.installation?.account?.type || 'User';

    if (!installationId) {
        return NextResponse.json({ error: 'Missing installation.id' }, { status: 400 });
    }

    if (action === 'deleted' || action === 'suspend') {
        // Remove installation record
        await prisma.gitHubInstallation.deleteMany({
            where: { installationId },
        });
        console.log(`[GitHub Webhook] Installation ${installationId} removed (${action})`);
        return NextResponse.json({ message: `Installation ${action}` });
    }

    // For 'created' / 'new_permissions_accepted' etc., we just log it.
    // The actual record is created during the callback flow when we know which org it belongs to.
    console.log(`[GitHub Webhook] Installation event: ${action} for ${accountLogin} (${installationId})`);
    return NextResponse.json({ message: `Installation event: ${action}` });
}
