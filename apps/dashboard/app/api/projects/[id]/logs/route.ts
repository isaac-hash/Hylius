import { NextResponse } from 'next/server';
import { prisma } from '../../../../../services/prisma';
import { SSHClient } from '@hylius/core';
import { decrypt } from '../../../../../services/crypto.service';

/**
 * GET /api/projects/[id]/logs
 *
 * Polling fallback for project runtime logs.
 * Fetches the last 200 lines from the running container or PM2 process via SSH.
 * Used when Socket.io is unavailable or as an initial snapshot.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    // Auth check via Authorization header
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await prisma.session.findUnique({
        where: { token },
        include: { user: { include: { organization: true } } }
    });
    if (!session || new Date(session.expiresAt) < new Date()) {
        return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    const project = await prisma.project.findFirst({
        where: {
            id,
            organizationId: session.user.organizationId ?? undefined,
        },
        include: { server: true },
    });

    if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Decrypt SSH key
    let privateKey = '';
    if (project.server.privateKeyEncrypted && project.server.keyIv) {
        try {
            privateKey = decrypt(project.server.privateKeyEncrypted, project.server.keyIv);
        } catch {
            return NextResponse.json({ error: 'Failed to decrypt SSH key' }, { status: 500 });
        }
    }

    const client = new SSHClient({
        // @ts-ignore
        host: project.server.ip,
        port: project.server.port,
        username: project.server.username,
        privateKey: privateKey.includes('BEGIN') ? privateKey : undefined,
        password: privateKey && !privateKey.includes('BEGIN') ? privateKey : undefined,
    });

    try {
        await client.connect();

        const containerName = `${project.name}-app`; // mirrors deploy.ts getContainerName()
        const lines: string[] = [];

        // Try docker logs first, fall back to PM2
        const { code: dockerCode, stdout: dockerOut } = await client.exec(
            `docker logs --tail 200 ${containerName} 2>&1`
        );

        if (dockerCode === 0 && dockerOut.trim()) {
            lines.push(...dockerOut.split('\n'));
        } else {
            // PM2 fallback
            const { stdout: pm2Out } = await client.exec(
                `pm2 logs ${project.name} --nocolor --lines 200 2>&1 | tail -200`
            );
            lines.push(...pm2Out.split('\n'));
        }

        return NextResponse.json({
            lines: lines.filter(l => l.trim() !== '').slice(-200),
            source: dockerCode === 0 ? 'docker' : 'pm2',
        });

    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'SSH connection failed' }, { status: 500 });
    } finally {
        client.end();
    }
}
