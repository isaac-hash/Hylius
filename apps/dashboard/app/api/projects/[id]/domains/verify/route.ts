import { NextResponse } from 'next/server';
import { prisma } from '../../../../../../services/prisma';
import { requireAuth } from '../../../../../../services/auth.service';
import { decrypt } from '../../../../../../services/crypto.service';
// @ts-ignore - Local workspace package
import { ServerConfig, verifyDns, configureCaddy, DomainConfig, SSHClient } from '@hylius/core';

// ─── POST: Re-verify DNS for a pending domain and activate if verified ───

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
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

        const serverIp = domain.project.server.ip;

        // Verify DNS
        const dnsResult = await verifyDns(hostname, serverIp);

        if (!dnsResult.verified) {
            await prisma.domain.update({
                where: { id: domain.id },
                data: {
                    status: 'PENDING',
                    errorMessage: dnsResult.error || `DNS does not point to ${serverIp}. Resolved: ${dnsResult.resolvedIps.join(', ') || 'none'}`,
                },
            });

            return NextResponse.json({
                verified: false,
                error: dnsResult.error,
                resolvedIps: dnsResult.resolvedIps,
                expectedIp: serverIp,
                dnsInstructions: {
                    message: `Add an A record for ${hostname} pointing to ${serverIp}`,
                    type: 'A',
                    name: hostname,
                    value: serverIp,
                },
            });
        }

        // DNS verified — configure Caddy
        try {
            let privateKey = '';
            if (domain.project.server.privateKeyEncrypted && domain.project.server.keyIv) {
                privateKey = decrypt(domain.project.server.privateKeyEncrypted, domain.project.server.keyIv);
            }

            const serverConfig: ServerConfig = {
                host: serverIp,
                port: domain.project.server.port,
                username: domain.project.server.username,
                privateKey: privateKey.includes('BEGIN') ? privateKey : undefined,
                password: privateKey && !privateKey.includes('BEGIN') ? privateKey : undefined,
            };

            // Determine upstream port
            let upstreamPort = '3000';
            if (domain.project.deployments[0]?.deployUrl) {
                try {
                    const url = new URL(domain.project.deployments[0].deployUrl);
                    upstreamPort = url.port || '3000';
                } catch { /* use default */ }
            }

            const allDomains: DomainConfig[] = domain.project.domains.map((d: any) => ({
                hostname: d.hostname,
                upstreamPort,
            }));

            const tlsMode = process.env.HYLIUS_TLS_MODE === 'internal' ? 'internal' as const : 'production' as const;

            const client = new SSHClient(serverConfig);
            await client.connect();
            await configureCaddy(client, { domains: allDomains, tlsMode });
            client.end();

            await prisma.domain.update({
                where: { id: domain.id },
                data: {
                    status: 'ACTIVE',
                    sslStatus: tlsMode === 'production' ? 'ACTIVE' : 'PENDING',
                    errorMessage: null,
                },
            });

            return NextResponse.json({
                verified: true,
                domain: await prisma.domain.findUnique({ where: { id: domain.id } }),
            });
        } catch (sshError: unknown) {
            const errorMessage = sshError instanceof Error ? sshError.message : String(sshError);
            await prisma.domain.update({
                where: { id: domain.id },
                data: {
                    status: 'DNS_VERIFIED',
                    errorMessage: `DNS verified but Caddy configuration failed: ${errorMessage}`,
                },
            });

            return NextResponse.json({
                verified: true,
                caddyConfigured: false,
                error: `DNS verified but Caddy configuration failed: ${errorMessage}`,
            }, { status: 500 });
        }
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to verify domain'
        }, { status: 500 });
    }
}
