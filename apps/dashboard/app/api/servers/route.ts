import { NextResponse } from 'next/server';
import { prisma } from '../../../services/prisma';
import { requireAuth } from '../../../services/auth.service';
import { encrypt } from '../../../services/crypto.service';
import { randomBytes } from 'crypto';

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

        if (!name) {
            return NextResponse.json({ error: 'Server name is required' }, { status: 400 });
        }

        // Encrypt SSH private key if provided
        let privateKeyEncrypted: string | null = null;
        let keyIv: string | null = null;

        if (privateKey) {
            const encrypted = encrypt(privateKey);
            privateKeyEncrypted = encrypted.encrypted;
            keyIv = encrypted.iv;
        }

        // Generate per-server agent token (shown once to user for install script)
        const agentToken = `hyl_${randomBytes(32).toString('hex')}`;

        // Clean the IP address (remove http:// or https:// if user accidentally included it)
        const cleanIp = ip ? ip.replace(/^https?:\/\//, '').split('/')[0].trim() : '';

        // Validate IPv4 format if an IP was provided
        if (cleanIp) {
            const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (!IPV4_REGEX.test(cleanIp)) {
                return NextResponse.json({ error: 'Invalid IP address format. Please enter a valid IPv4 address (e.g. 203.0.113.1)' }, { status: 400 });
            }
            const octets = cleanIp.split('.').map(Number);
            if (octets.some((o: number) => o < 0 || o > 255)) {

                return NextResponse.json({ error: 'Invalid IP address: each octet must be between 0 and 255' }, { status: 400 });
            }
        }

        const resolvedIp = cleanIp || 'pending...';

        const server = await prisma.server.create({
            data: {
                name,
                ip: resolvedIp,
                username: username || 'root',
                port: port || 22,
                privateKeyEncrypted,
                keyIv,
                osType: osType || 'Linux',
                agentToken,
                connectionMode: 'AGENT', // Start as AGENT
                organizationId: auth.organizationId,
            },
        });

        // Log the action
        await prisma.auditLog.create({
            data: {
                action: 'SERVER_CREATED',
                organizationId: auth.organizationId,
                metadata: JSON.stringify({ serverId: server.id, name: server.name, ip: server.ip })
            }
        });

        // Return safe server data + agentToken (shown once for install command)
        const { privateKeyEncrypted: _, keyIv: __, ...safeServer } = server;
        return NextResponse.json({ ...safeServer, agentToken });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'Unauthorized') {
            return NextResponse.json({ error: message }, { status: 401 });
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

