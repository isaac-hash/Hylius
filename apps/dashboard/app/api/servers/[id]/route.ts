import { NextResponse } from 'next/server';
import { prisma } from '../../../../services/prisma';
import { requireAuth } from '../../../../services/auth.service';
import { encrypt } from '../../../../services/crypto.service';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });

        const params = await context.params;
        const id = params.id;

        const server = await prisma.server.findFirst({
            where: {
                id: id,
                organizationId: auth.organizationId
            },
            include: {
                projects: {
                    include: {
                        deployments: {
                            orderBy: { startedAt: 'desc' },
                            take: 5
                        }
                    }
                },
                metrics: {
                    orderBy: { createdAt: 'desc' },
                    take: 24, // Last 24 metric points
                }
            },
        });

        if (!server) {
            return NextResponse.json({ error: 'Server not found' }, { status: 404 });
        }

        // Never return encrypted key data
        const { privateKeyEncrypted: _, keyIv: __, ...safeServer } = server;
        return NextResponse.json(safeServer);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });

        const params = await context.params;
        const id = params.id;

        const server = await prisma.server.findFirst({
            where: { id: id, organizationId: auth.organizationId }
        });

        if (!server) {
            return NextResponse.json({ error: 'Server not found' }, { status: 404 });
        }

        // Must manually delete related records to satisfy foreign key constraints
        await prisma.deployment.deleteMany({
            where: { project: { serverId: id } }
        });

        await prisma.project.deleteMany({
            where: { serverId: id }
        });

        await prisma.metric.deleteMany({
            where: { serverId: id }
        });

        await prisma.server.delete({
            where: { id: id }
        });

        await prisma.auditLog.create({
            data: {
                action: 'SERVER_DELETED',
                organizationId: auth.organizationId,
                metadata: JSON.stringify({ serverId: server.id, name: server.name })
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });

        const params = await context.params;
        const id = params.id;
        const body = await request.json();
        const { name, ip, username, port, privateKey, osType } = body;

        const server = await prisma.server.findFirst({
            where: { id: id, organizationId: auth.organizationId }
        });

        if (!server) {
            return NextResponse.json({ error: 'Server not found' }, { status: 404 });
        }

        const updateData: any = {
            name,
            ip,
            username,
            port: port || 22,
            osType,
        };

        if (privateKey) {
            const encrypted = encrypt(privateKey);
            updateData.privateKeyEncrypted = encrypted.encrypted;
            updateData.keyIv = encrypted.iv;
        }

        const updatedServer = await prisma.server.update({
            where: { id: id },
            data: updateData
        });

        await prisma.auditLog.create({
            data: {
                action: 'SERVER_UPDATED',
                organizationId: auth.organizationId,
                metadata: JSON.stringify({ serverId: updatedServer.id, name: updatedServer.name })
            }
        });

        const { privateKeyEncrypted: _, keyIv: __, ...safeServer } = updatedServer;
        return NextResponse.json(safeServer);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
