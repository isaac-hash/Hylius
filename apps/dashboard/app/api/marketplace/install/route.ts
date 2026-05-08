import { NextResponse } from 'next/server';
import { prisma } from '../../../../services/prisma';
import { requireAuth } from '../../../../services/auth.service';
import { deployUmami } from '../../../../services/umami.service';

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

        // ─── Plan enforcement ────────────────────────────────────────
        const org = await prisma.organization.findUnique({
            where: { id: auth.organizationId },
            select: { plan: true },
        });

        if (!org || (org.plan === 'FREE' && auth.role !== 'PLATFORM_ADMIN')) {
            return NextResponse.json(
                { error: 'This feature requires a paid plan. Please upgrade to Pro.' },
                { status: 403 },
            );
        }

        // ─── Feature-specific handlers ───────────────────────────────
        switch (featureId) {
            case 'umami': {
                if (!serverId) {
                    return NextResponse.json({ error: 'serverId is required for Umami installation' }, { status: 400 });
                }

                // Verify ownership
                const server = await prisma.server.findFirst({
                    where: { id: serverId, organizationId: auth.organizationId },
                });

                if (!server) {
                    return NextResponse.json({ error: 'Server not found' }, { status: 404 });
                }

                if (server.hasTrafficAnalytics) {
                    return NextResponse.json({ error: 'Traffic analytics is already enabled on this server' }, { status: 409 });
                }

                // Mark as deploying (trafficAnalyticsUrl still null until done)
                // We do NOT set hasTrafficAnalytics=true here — deployUmami sets it on success.

                await prisma.auditLog.create({
                    data: {
                        action: 'FEATURE_INSTALLED',
                        organizationId: auth.organizationId,
                        userId: auth.userId,
                        metadata: JSON.stringify({ featureId, serverId }),
                    },
                });

                // Fire-and-forget: deploy Umami in the background
                deployUmami(serverId).catch((err) => {
                    console.error(`[Marketplace] Umami deployment failed for server ${serverId}:`, err.message);
                });

                return NextResponse.json({ success: true, feature: 'umami', serverId, status: 'deploying' });
            }

            case 'pagespeed': {
                // PageSpeed doesn't require server-side provisioning — it's API-only
                await prisma.auditLog.create({
                    data: {
                        action: 'FEATURE_INSTALLED',
                        organizationId: auth.organizationId,
                        userId: auth.userId,
                        metadata: JSON.stringify({ featureId }),
                    },
                });

                return NextResponse.json({ success: true, feature: 'pagespeed' });
            }

            case 'uptime': {
                if (!serverId) {
                    return NextResponse.json({ error: 'serverId is required for Uptime Monitoring installation' }, { status: 400 });
                }

                // Verify ownership
                const server = await prisma.server.findFirst({
                    where: { id: serverId, organizationId: auth.organizationId },
                });

                if (!server) {
                    return NextResponse.json({ error: 'Server not found' }, { status: 404 });
                }

                if (server.hasUptimeMonitoring) {
                    return NextResponse.json({ error: 'Uptime Monitoring is already enabled on this server' }, { status: 409 });
                }

                await prisma.server.update({
                    where: { id: serverId },
                    data: { hasUptimeMonitoring: true }
                });

                await prisma.auditLog.create({
                    data: {
                        action: 'FEATURE_INSTALLED',
                        organizationId: auth.organizationId,
                        userId: auth.userId,
                        metadata: JSON.stringify({ featureId, serverId }),
                    },
                });

                return NextResponse.json({ success: true, feature: 'uptime', serverId });
            }

            default:
                return NextResponse.json({ error: `Unknown feature: ${featureId}` }, { status: 400 });
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
