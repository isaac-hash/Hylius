import { NextResponse } from 'next/server';
import { prisma } from '../../../services/prisma';
import { requireAuth } from '../../../services/auth.service';
import { encrypt } from '../../../services/crypto.service';

export async function GET(request: Request) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });

        const servers = await prisma.server.findMany({
            where: { organizationId: auth.organizationId },
            orderBy: { createdAt: 'desc' },
            include: {
                projects: true,
            },
        });

        return NextResponse.json(servers);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });
        const body = await request.json();
        const { name, ip, username, port, privateKey, osType } = body;

        if (!name || !ip || !username) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Encrypt SSH private key if provided
        let privateKeyEncrypted: string | null = null;
        let keyIv: string | null = null;

        if (privateKey) {
            const encrypted = encrypt(privateKey);
            privateKeyEncrypted = encrypted.encrypted;
            keyIv = encrypted.iv;
        }

        const server = await prisma.server.create({
            data: {
                name,
                ip,
                username,
                port: port || 22,
                privateKeyEncrypted,
                keyIv,
                osType,
                organizationId: auth.organizationId,
            },
        });

        // Never return encrypted key data to the client
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
