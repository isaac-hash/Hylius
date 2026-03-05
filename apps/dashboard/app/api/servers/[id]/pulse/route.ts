import { NextResponse } from 'next/server';
import { prisma } from '../../../../../services/prisma';
import { requireAuth } from '../../../../../services/auth.service';
import { decrypt } from '../../../../../services/crypto.service';
import { getPulse, ServerConfig } from '@hylius/core';

/**
 * POST /api/servers/[id]/pulse
 * Triggers a live SSH pulse check on the server,
 * stores the result as a Metric record, and returns the metrics.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) {
            return NextResponse.json({ error: 'Organization required' }, { status: 400 });
        }

        const params = await context.params;
        const id = params.id;

        // Fetch server with encrypted key
        const server = await prisma.server.findFirst({
            where: {
                id,
                organizationId: auth.organizationId,
            },
        });

        if (!server) {
            return NextResponse.json({ error: 'Server not found' }, { status: 404 });
        }

        // Decrypt SSH key in-memory
        let privateKey = '';
        if (server.privateKeyEncrypted && server.keyIv) {
            try {
                privateKey = decrypt(server.privateKeyEncrypted, server.keyIv);
            } catch (e) {
                return NextResponse.json({ error: 'Failed to decrypt SSH key' }, { status: 500 });
            }
        }

        const serverConfig: ServerConfig = {
            host: server.ip,
            port: server.port,
            username: server.username,
            privateKey,
        };

        // Execute SSH pulse
        const pulse = await getPulse(serverConfig);

        // Store the metric
        const metric = await prisma.metric.create({
            data: {
                serverId: id,
                cpu: pulse.cpu,
                memory: pulse.memory,
                disk: pulse.disk,
                uptime: pulse.uptime,
            },
        });

        return NextResponse.json({
            cpu: metric.cpu,
            memory: metric.memory,
            disk: metric.disk,
            uptime: metric.uptime,
            createdAt: metric.createdAt,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        console.error('Pulse check failed:', message);
        return NextResponse.json({ error: `Pulse check failed: ${message}` }, { status: 500 });
    }
}
