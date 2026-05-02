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
