import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../services/prisma';
import { AuthService } from '../../../../../../services/auth.service';
import { agentGateway } from '../../../../../../services/agent-gateway.service';

const GITHUB_REPO = 'Hylius-org/hylius-agent';
const GITHUB_RELEASE_BASE = `https://github.com/${GITHUB_REPO}/releases/latest/download`;

/**
 * POST /api/admin/servers/[id]/update-agent
 *
 * Triggers an in-place agent self-update on the target VPS.
 * The VPS downloads the new binary directly from GitHub Releases,
 * replaces the old binary, and restarts the systemd service.
 *
 * The agent WebSocket will drop and reconnect automatically after restart.
 * Protected: platform admin only.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await AuthService.requirePlatformAdmin(request);
        const { id } = await params;

        const server = await prisma.server.findUnique({ where: { id } });
        if (!server) return NextResponse.json({ error: 'Server not found' }, { status: 404 });

        if (!agentGateway.isConnected(id)) {
            return NextResponse.json(
                { error: 'Agent is not connected. Cannot update an offline server.' },
                { status: 400 },
            );
        }

        // Detect architecture and pick the right binary from GitHub Releases
        // The exec command detects arch, downloads from GH Releases, replaces, restarts.
        const updateCmd = [
            // Detect architecture
            `ARCH=$(uname -m)`,
            `case "$ARCH" in x86_64) ARCH=amd64 ;; aarch64) ARCH=arm64 ;; *) echo "Unsupported arch: $ARCH" && exit 1 ;; esac`,
            // Download the latest binary from GitHub Releases
            `curl -sSL "${GITHUB_RELEASE_BASE}/hylius-agent-linux-$ARCH" -o /tmp/hylius-agent-update`,
            // Verify it's not an HTML error page (GitHub returns 404 HTML for missing releases)
            `file /tmp/hylius-agent-update | grep -q ELF || (echo "Downloaded binary is invalid — check GitHub Releases" && rm /tmp/hylius-agent-update && exit 1)`,
            // Atomically replace
            `chmod +x /tmp/hylius-agent-update`,
            `mv /tmp/hylius-agent-update /usr/local/bin/hylius-agent`,
            // Restart — the agent process will exit here; systemd brings it back
            `systemctl restart hylius-agent`,
        ].join(' && ');

        // Fire-and-forget: restart kills the connection, so we don't await completion
        agentGateway.streamCommand(
            id,
            'exec',
            { cmd: updateCmd },
            () => { /* discard output */ },
        ).catch(() => {
            // Expected: WebSocket closes when agent process is replaced
        });

        // Brief pause to let the download start before we respond
        await new Promise(r => setTimeout(r, 1500));

        await prisma.auditLog.create({
            data: {
                action: 'AGENT_UPDATE_TRIGGERED',
                organizationId: server.organizationId,
                userId: 'admin',
                metadata: JSON.stringify({
                    serverId: id,
                    serverName: server.name,
                    source: 'github-releases',
                    repo: GITHUB_REPO,
                }),
            },
        });

        return NextResponse.json({
            success: true,
            message: `Update sent to ${server.name}. The agent will download the latest binary from GitHub Releases, replace itself, and reconnect in ~10 seconds.`,
            serverId: id,
            binarySource: `${GITHUB_RELEASE_BASE}/hylius-agent-linux-{amd64|arm64}`,
        });

    } catch (error: any) {
        if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (error.message?.includes('Forbidden')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
