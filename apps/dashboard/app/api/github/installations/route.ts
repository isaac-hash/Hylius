import { NextResponse } from 'next/server';
import { prisma } from '../../../../services/prisma';
import { requireAuth } from '../../../../services/auth.service';
import { getInstallationOctokit } from '../../../../services/github.service';

/**
 * Handle POST /api/github/installations
 * Called by the frontend after returning from the GitHub App installation flow.
 * Links the installation to the user's organization.
 */
export async function POST(request: Request) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) {
            return NextResponse.json({ error: 'Organization required' }, { status: 400 });
        }

        const body = await request.json();
        let { installationId, accountLogin, accountType } = body;

        const id = parseInt(installationId, 10);
        if (!id || isNaN(id)) {
            return NextResponse.json({ error: 'Valid installationId required' }, { status: 400 });
        }

        // If accountLogin wasn't provided, fetch it from the GitHub API
        if (!accountLogin || accountLogin === 'unknown') {
            try {
                const octokit = await getInstallationOctokit(id);
                const { data } = await octokit.apps.getInstallation({ installation_id: id });
                accountLogin = (data.account as any)?.login || 'unknown';
                accountType = (data.account as any)?.type || 'User';
            } catch {
                // Non-critical — we'll just use 'unknown'
            }
        }

        // Upsert the installation record to link it to the organization
        const installation = await prisma.gitHubInstallation.upsert({
            where: { installationId: id },
            create: {
                installationId: id,
                accountLogin: accountLogin || 'unknown',
                accountType: accountType || 'User',
                organizationId: auth.organizationId,
            },
            update: {
                accountLogin: accountLogin || undefined,
                accountType: accountType || undefined,
                organizationId: auth.organizationId,
                updatedAt: new Date(),
            },
        });

        console.log(`[GitHub API] Installation ${id} linked to org ${auth.organizationId}`);

        return NextResponse.json({ success: true, installation });
    } catch (error: unknown) {
        console.error('[GitHub API] Failed to link installation:', error);
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
