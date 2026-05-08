import { NextResponse } from 'next/server';
import { prisma } from '../../../../services/prisma';
import { requireAuth } from '../../../../services/auth.service';
import { uninstallUmami } from '../../../../services/umami.service';

export async function POST(request: Request) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) {
            return NextResponse.json({ error: 'Organization required' }, { status: 400 });
        }

        const body = await request.json();
        const { featureId, serverId } = body;

        if (!featureId) {
            return NextResponse.json({ error: 'featureId is required' }, { status: 400 });
        }

        switch (featureId) {
            case 'umami': {
                if (!serverId) {
                    return NextResponse.json({ error: 'serverId is required' }, { status: 400 });
                }

                // Verify ownership
                const server = await prisma.server.findFirst({
                    where: { id: serverId, organizationId: auth.organizationId },
                });

                if (!server) {
                    return NextResponse.json({ error: 'Server not found' }, { status: 404 });
                }

                if (!server.hasTrafficAnalytics) {
                    return NextResponse.json({ error: 'Traffic Analytics is not installed on this server' }, { status: 409 });
                }

                // Run uninstall (async, fire-and-forget for heavy cleanup)
                uninstallUmami(serverId).catch((err) => {
                    console.error(`[Marketplace] Umami uninstall failed for server ${serverId}:`, err.message);
                });

                await prisma.auditLog.create({
                    data: {
                        action: 'FEATURE_UNINSTALLED',
                        organizationId: auth.organizationId,
                        userId: auth.userId,
                        metadata: JSON.stringify({ featureId, serverId }),
                    },
                });

                return NextResponse.json({ success: true, feature: 'umami', serverId });
            }

            case 'pagespeed': {
                // PageSpeed is API-only, nothing to uninstall server-side
                await prisma.auditLog.create({
                    data: {
                        action: 'FEATURE_UNINSTALLED',
                        organizationId: auth.organizationId,
                        userId: auth.userId,
                        metadata: JSON.stringify({ featureId }),
                    },
                });

                return NextResponse.json({ success: true, feature: 'pagespeed' });
            }

            case 'uptime': {
                if (!serverId) {
                    return NextResponse.json({ error: 'serverId is required' }, { status: 400 });
                }

                // Verify ownership
                const server = await prisma.server.findFirst({
                    where: { id: serverId, organizationId: auth.organizationId },
                });

                if (!server) {
                    return NextResponse.json({ error: 'Server not found' }, { status: 404 });
                }

                if (!server.hasUptimeMonitoring) {
                    return NextResponse.json({ error: 'Uptime Monitoring is not installed on this server' }, { status: 409 });
                }

                // Remove all monitors from DB and stop them on Agent
                const { UptimeService } = await import('../../../../services/uptime.service');
                const monitors = await prisma.uptimeMonitor.findMany({ where: { serverId } });
                for (const monitor of monitors) {
                    await UptimeService.stopMonitorOnAgent(serverId, monitor.id);
                }
                
                await prisma.uptimeMonitor.deleteMany({ where: { serverId } });

                await prisma.server.update({
                    where: { id: serverId },
                    data: { hasUptimeMonitoring: false }
                });

                await prisma.auditLog.create({
                    data: {
                        action: 'FEATURE_UNINSTALLED',
                        organizationId: auth.organizationId,
                        userId: auth.userId,
                        metadata: JSON.stringify({ featureId, serverId }),
                    },
                });

                return NextResponse.json({ success: true, feature: 'uptime', serverId });
            }

            case 'glitchtip': {
                if (!serverId) {
                    return NextResponse.json({ error: 'serverId is required' }, { status: 400 });
                }

                const server = await prisma.server.findFirst({
                    where: { id: serverId, organizationId: auth.organizationId },
                });

                if (!server) {
                    return NextResponse.json({ error: 'Server not found' }, { status: 404 });
                }

                if (!server.hasErrorTracking) {
                    return NextResponse.json({ error: 'Error Tracking is not installed on this server' }, { status: 409 });
                }

                const { GlitchtipService } = await import('../../../../services/glitchtip.service');
                
                GlitchtipService.uninstall(serverId, auth.userId).catch((err) => {
                    console.error(`[Marketplace] GlitchTip uninstall failed for server ${serverId}:`, err.message);
                });

                await prisma.auditLog.create({
                    data: {
                        action: 'FEATURE_UNINSTALLED',
                        organizationId: auth.organizationId,
                        userId: auth.userId,
                        metadata: JSON.stringify({ featureId, serverId }),
                    },
                });

                return NextResponse.json({ success: true, feature: 'glitchtip', serverId });
            }

            default:
                return NextResponse.json({ error: 'Unknown feature' }, { status: 400 });
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
