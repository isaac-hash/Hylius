import { NextResponse } from 'next/server';

/**
 * GitHub App Installation Callback
 *
 * After a user installs the Hylius GitHub App on their account/org,
 * GitHub redirects here with ?installation_id=...&setup_action=install
 *
 * We redirect back to the dashboard so the frontend (which has the auth token)
 * can attach it to the organization securely.
 */
export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const installationId = url.searchParams.get('installation_id');
        const setupAction = url.searchParams.get('setup_action');

        if (!installationId) {
            return NextResponse.redirect(new URL('/?error=missing_installation', request.url));
        }

        // Construct the base URL from headers to handle reverse proxies like ngrok
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
        const baseUrl = `${protocol}://${host}`;

        // Just forward the params to the frontend which holds the auth token.
        const redirectUrl = new URL('/github/link', baseUrl);
        redirectUrl.searchParams.set('github_install', installationId);
        if (setupAction) redirectUrl.searchParams.set('setup_action', setupAction);

        // Forward account info if GitHub provided it (optional)
        const accountLogin = url.searchParams.get('account_login');
        const accountType = url.searchParams.get('account_type');
        if (accountLogin) redirectUrl.searchParams.set('account_login', accountLogin);
        if (accountType) redirectUrl.searchParams.set('account_type', accountType);

        return NextResponse.redirect(redirectUrl);
    } catch (error: unknown) {
        console.error('[GitHub Callback] Error:', error);
        return NextResponse.redirect(new URL('/?error=github_callback_failed', request.url));
    }
}
