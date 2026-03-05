import { NextResponse } from 'next/server';
import { prisma } from '../../../../../services/prisma';
import { requireAuth } from '../../../../../services/auth.service';
import { decrypt } from '../../../../../services/crypto.service';
// @ts-ignore - Local workspace package
import { ServerConfig, setupDomain, configureCaddy, DomainConfig, SSHClient } from '@hylius/core';

// ─── GET: List domains for a project ────────────────────────

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });

        const params = await context.params;
        const projectId = params.id;

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { organizationId: true },
        });

        if (!project || project.organizationId !== auth.organizationId) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const domains = await prisma.domain.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(domains);
    } catch (error: any) {
        if (error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return NextResponse.json({ error: error.message || 'Failed to list domains' }, { status: 500 });
    }
}

// ─── POST: Add a new domain to a project ────────────────────

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });

        const params = await context.params;
        const projectId = params.id;
        const { hostname } = await request.json();

        // Validate hostname format
        if (!hostname || typeof hostname !== 'string') {
            return NextResponse.json({ error: 'hostname is required' }, { status: 400 });
        }

        const cleanHostname = hostname.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
        if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/.test(cleanHostname)) {
            return NextResponse.json({ error: 'Invalid domain format. Example: myapp.com or api.myapp.com' }, { status: 400 });
        }

        // Check global uniqueness
        const existing = await prisma.domain.findUnique({ where: { hostname: cleanHostname } });
        if (existing) {
            return NextResponse.json({ error: `Domain ${cleanHostname} is already in use by another project` }, { status: 409 });
        }

        // Fetch the project + server
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                server: true,
                domains: true,
                deployments: { orderBy: { startedAt: 'desc' }, take: 1 },
            },
        });

        if (!project || project.organizationId !== auth.organizationId) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const serverIp = project.server.ip;

        // Build server config for SSH
        let privateKey = '';
        if (project.server.privateKeyEncrypted && project.server.keyIv) {
            privateKey = decrypt(project.server.privateKeyEncrypted, project.server.keyIv);
        }

        const serverConfig: ServerConfig = {
            host: serverIp,
            port: project.server.port,
            username: project.server.username,
            privateKey: privateKey.includes('BEGIN') ? privateKey : undefined,
            password: privateKey && !privateKey.includes('BEGIN') ? privateKey : undefined,
        };

        // Determine upstream port from the latest deployment URL or default to 3000
        let upstreamPort = '3000';
        if (project.deployments[0]?.deployUrl) {
            try {
                const url = new URL(project.deployments[0].deployUrl);
                upstreamPort = url.port || '3000';
            } catch { /* use default */ }
        }

        // Create the domain record (initially PENDING)
        const domain = await prisma.domain.create({
            data: {
                hostname: cleanHostname,
                projectId,
                status: 'PENDING',
                sslStatus: 'PENDING',
            },
        });

        // Build the full domain list for Caddy (existing + new)
        const allDomains: DomainConfig[] = [
            ...project.domains.map((d: any) => ({
                hostname: d.hostname,
                upstreamPort, // Use the same project port for all domains
            })),
            { hostname: cleanHostname, upstreamPort },
        ];

        const tlsMode = process.env.HYLIUS_TLS_MODE === 'internal' ? 'internal' as const : 'production' as const;

        // Attempt full setup (DNS verify + Caddy configure)
        const result = await setupDomain(
            serverConfig,
            allDomains,
            cleanHostname,
            serverIp,
            { tlsMode }
        );

        if (result.success) {
            await prisma.domain.update({
                where: { id: domain.id },
                data: {
                    status: 'ACTIVE',
                    sslStatus: result.sslProvisioned ? 'ACTIVE' : 'PENDING',
                },
            });
        } else {
            await prisma.domain.update({
                where: { id: domain.id },
                data: {
                    status: 'PENDING',
                    errorMessage: result.error,
                },
            });
        }

        const updatedDomain = await prisma.domain.findUnique({ where: { id: domain.id } });

        return NextResponse.json({
            domain: updatedDomain,
            dnsInstructions: !result.success ? {
                message: `Add an A record for ${cleanHostname} pointing to ${serverIp}`,
                type: 'A',
                name: cleanHostname,
                value: serverIp,
            } : null,
        }, { status: 201 });

    } catch (error: any) {
        if (error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return NextResponse.json({ error: error.message || 'Failed to add domain' }, { status: 500 });
    }
}

// ─── DELETE: Remove a domain from a project ─────────────────

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAuth(request);
        if (!auth.organizationId) return NextResponse.json({ error: 'Organization required' }, { status: 400 });

        const params = await context.params;
        const projectId = params.id;
        const { hostname } = await request.json();

        if (!hostname) {
            return NextResponse.json({ error: 'hostname is required' }, { status: 400 });
        }

        // Find the domain
        const domain = await prisma.domain.findFirst({
            where: { hostname, projectId },
            include: {
                project: {
                    include: {
                        server: true,
                        domains: true,
                        deployments: { orderBy: { startedAt: 'desc' }, take: 1 },
                    },
                },
            },
        });

        if (!domain || domain.project.organizationId !== auth.organizationId) {
            return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
        }

        // Remove from Caddy on the VPS
        try {
            let privateKey = '';
            if (domain.project.server.privateKeyEncrypted && domain.project.server.keyIv) {
                privateKey = decrypt(domain.project.server.privateKeyEncrypted, domain.project.server.keyIv);
            }

            const serverConfig: ServerConfig = {
                host: domain.project.server.ip,
                port: domain.project.server.port,
                username: domain.project.server.username,
                privateKey: privateKey.includes('BEGIN') ? privateKey : undefined,
                password: privateKey && !privateKey.includes('BEGIN') ? privateKey : undefined,
            };

            // Build remaining domain list (exclude the one being removed)
            let upstreamPort = '3000';
            if (domain.project.deployments[0]?.deployUrl) {
                try {
                    const url = new URL(domain.project.deployments[0].deployUrl);
                    upstreamPort = url.port || '3000';
                } catch { /* use default */ }
            }

            const remainingDomains: DomainConfig[] = domain.project.domains
                .filter((d: any) => d.hostname !== hostname)
                .map((d: any) => ({
                    hostname: d.hostname,
                    upstreamPort,
                }));

            const tlsMode = process.env.HYLIUS_TLS_MODE === 'internal' ? 'internal' as const : 'production' as const;

            const client = new SSHClient(serverConfig);
            await client.connect();
            await configureCaddy(client, { domains: remainingDomains, tlsMode });
            client.end();
        } catch (sshError: any) {
            console.warn(`Caddy cleanup failed for ${hostname}: ${sshError.message}`);
        }

        // Delete from DB
        await prisma.domain.delete({ where: { id: domain.id } });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        if (error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return NextResponse.json({ error: error.message || 'Failed to delete domain' }, { status: 500 });
    }
}
