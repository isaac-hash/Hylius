import { NextResponse } from 'next/server';
import { prisma } from '../../../../services/prisma';
import { requireAuth } from '../../../../services/auth.service';

/**
 * GitHub App Installation Callback
 *
 * After a user installs the Hylius GitHub App on their account/org,
 * GitHub redirects here with ?installation_id=...&setup_action=install
 *
 * We save the installation and redirect back to the dashboard.
 */
export async function GET(request: Request) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) {
            return NextResponse.redirect(new URL('/?error=org_required', request.url));
        }

        const url = new URL(request.url);
        const installationId = parseInt(url.searchParams.get('installation_id') || '', 10);
        const setupAction = url.searchParams.get('setup_action') || 'install';

        if (!installationId || isNaN(installationId)) {
            return NextResponse.redirect(new URL('/?error=missing_installation', request.url));
        }

        if (setupAction === 'install' || setupAction === 'update') {
            // Upsert the installation record
            await prisma.gitHubInstallation.upsert({
                where: { installationId },
                create: {
                    installationId,
                    accountLogin: url.searchParams.get('account_login') || 'unknown',
                    accountType: url.searchParams.get('account_type') || 'User',
                    organizationId: auth.organizationId,
                },
                update: {
                    organizationId: auth.organizationId,
                    updatedAt: new Date(),
                },
            });

            console.log(`[GitHub Callback] Installation ${installationId} saved for org ${auth.organizationId}`);
        }

        // Redirect back to dashboard with success indicator
        return NextResponse.redirect(new URL('/?github=connected', request.url));
    } catch (error: any) {
        console.error('[GitHub Callback] Error:', error);
        return NextResponse.redirect(new URL('/?error=github_callback_failed', request.url));
    }
}
