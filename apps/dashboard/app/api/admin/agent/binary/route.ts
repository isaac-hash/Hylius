import { NextResponse } from 'next/server';
import { AuthService } from '../../../../../services/auth.service';

const GITHUB_REPO = 'Hylius-org/hylius-agent';
const GITHUB_RELEASE_BASE = `https://github.com/${GITHUB_REPO}/releases/latest/download`;

/**
 * GET /api/admin/agent/binary/info
 *
 * Returns metadata about where to download the latest agent binary from.
 * The VPS will curl directly from GitHub Releases — the dashboard never
 * serves the binary itself. Protected: platform admin only.
 */
export async function GET(request: Request) {
    try {
        await AuthService.requirePlatformAdmin(request);

        return NextResponse.json({
            repo: GITHUB_REPO,
            amd64: `${GITHUB_RELEASE_BASE}/hylius-agent-linux-amd64`,
            arm64: `${GITHUB_RELEASE_BASE}/hylius-agent-linux-arm64`,
            installScript: `https://raw.githubusercontent.com/${GITHUB_REPO}/main/scripts/install.sh`,
        });
    } catch (error: any) {
        if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (error.message?.includes('Forbidden')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
