import { NextResponse } from 'next/server';
import { prisma } from '../../../../services/prisma';
import { requireAuth } from '../../../../services/auth.service';
import { listRepos } from '../../../../services/github.service';

/**
 * List GitHub repos accessible to the organization's GitHub App installation.
 *
 * GET /api/github/repos
 */
export async function GET(request: Request) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) {
            return NextResponse.json({ error: 'Organization required' }, { status: 400 });
        }

        // Find the installation for this org
        const installation = await prisma.gitHubInstallation.findFirst({
            where: { organizationId: auth.organizationId },
            orderBy: { createdAt: 'desc' },
        });

        if (!installation) {
            return NextResponse.json({
                connected: false,
                repos: [],
                message: 'No GitHub App installation found. Connect GitHub first.',
            });
        }

        // List repos from GitHub API
        const repos = await listRepos(installation.installationId);

        return NextResponse.json({
            connected: true,
            installation: {
                id: installation.id,
                installationId: installation.installationId,
                accountLogin: installation.accountLogin,
                accountType: installation.accountType,
            },
            repos,
        });
    } catch (error: any) {
        if (error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        console.error('[GitHub Repos API] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to list repos' }, { status: 500 });
    }
}
