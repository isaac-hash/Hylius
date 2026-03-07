import { NextResponse } from 'next/server';
import { prisma } from '../../../services/prisma';
import { requireAuth } from '../../../services/auth.service';
import { autoProvisionWorkflow } from '../../../services/github-workflow.service';

export async function GET(request: Request) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });

        const projects = await prisma.project.findMany({
            where: { organizationId: auth.organizationId },
            orderBy: { createdAt: 'desc' },
            include: {
                server: {
                    select: { id: true, name: true, ip: true },
                },
                _count: {
                    select: { deployments: true },
                },
            },
        });

        return NextResponse.json(projects);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });
        const body = await request.json();
        const { name, repoUrl, branch, deployPath, buildCommand, startCommand, serverId, githubRepoFullName, githubInstallationId, deployStrategy } = body;

        if (!name || !repoUrl || !deployPath || !serverId) {
            return NextResponse.json(
                { error: 'Missing required fields: name, repoUrl, deployPath, serverId' },
                { status: 400 }
            );
        }

        // Verify server belongs to the same org
        const server = await prisma.server.findFirst({
            where: { id: serverId, organizationId: auth.organizationId },
        });

        if (!server) {
            return NextResponse.json(
                { error: 'Server not found or does not belong to your organization' },
                { status: 404 }
            );
        }

        const project = await prisma.project.create({
            data: {
                name,
                repoUrl,
                branch: branch || 'main',
                deployPath,
                buildCommand: buildCommand || null,
                startCommand: startCommand || null,
                githubRepoFullName: githubRepoFullName || null,
                githubInstallationId: githubInstallationId || null,
                deployStrategy: deployStrategy || 'auto',
                serverId,
                organizationId: auth.organizationId,
            },
            include: {
                server: {
                    select: { id: true, name: true, ip: true },
                },
            },
        });

        // Log the action
        await prisma.auditLog.create({
            data: {
                action: 'PROJECT_CREATED',
                organizationId: auth.organizationId,
                metadata: JSON.stringify({ projectId: project.id, name: project.name, serverId: project.serverId })
            }
        });

        // If the user chose to use GitHub Actions, provision the workflow file in their repo
        if (deployStrategy === 'ghcr-pull' && githubInstallationId && githubRepoFullName) {
            // Non-blocking fire-and-forget so UI returns quickly
            autoProvisionWorkflow(githubInstallationId, githubRepoFullName, project.branch)
                .catch(err => { console.error('[Projects API] Workflow provision failed:', err); });
        }

        return NextResponse.json(project);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
