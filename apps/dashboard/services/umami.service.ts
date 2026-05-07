/* eslint-disable no-console */
/**
 * Umami Deployment Service
 *
 * Deploys the Umami analytics stack (Postgres + Umami) as Docker containers
 * on a target VPS via the connected agent.
 */

import { prisma } from './prisma';
import { agentGateway } from './agent-gateway.service';
import { umamiLogin } from './umami-api.service';
import crypto from 'crypto';

const UMAMI_IMAGE = 'ghcr.io/umami-software/umami:postgresql-latest';
const POSTGRES_IMAGE = 'postgres:15-alpine';
const UMAMI_PORT = '3100'; // Host port for Umami

/**
 * Deploy Umami on a server via the agent.
 * This runs asynchronously — the caller should fire-and-forget.
 */
export async function deployUmami(serverId: string): Promise<void> {
    console.log(`[Umami] Starting deployment on server ${serverId}`);

    // Verify agent is connected
    if (!agentGateway.isConnected(serverId)) {
        console.error(`[Umami] Agent not connected for server ${serverId}`);
        await prisma.server.update({
            where: { id: serverId },
            data: { hasTrafficAnalytics: false } as any,
        });
        throw new Error('Agent is not connected. Please ensure the Hylius agent is running on your VPS.');
    }

    const dbPassword = crypto.randomBytes(16).toString('hex');
    const log = (msg: string) => console.log(`[Umami:${serverId}] ${msg}`);

    try {
        // 1. Ensure hylius Docker network
        log('Ensuring Docker network...');
        await runAgentCommand(serverId, 'docker network create hylius 2>/dev/null || true');

        // 2. Deploy Postgres for Umami
        log('Deploying Postgres for Umami...');
        await runAgentCommand(serverId, 'docker rm -f hylius-umami-db > /dev/null 2>&1 || true');
        await runAgentCommand(serverId, [
            `docker run -d`,
            `--name hylius-umami-db`,
            `--network hylius`,
            `--restart unless-stopped`,
            `-e POSTGRES_DB=umami`,
            `-e POSTGRES_USER=umami`,
            `-e POSTGRES_PASSWORD=${dbPassword}`,
            `-v hylius-umami-data:/var/lib/postgresql/data`,
            POSTGRES_IMAGE,
        ].join(' '));

        // 3. Wait for Postgres to be ready (max 20s)
        log('Waiting for Postgres to be ready...');
        await runAgentCommand(serverId,
            `for i in $(seq 1 20); do docker exec hylius-umami-db pg_isready -U umami > /dev/null 2>&1 && echo "READY" && break || sleep 1; done`
        );

        // 4. Deploy Umami container
        log('Deploying Umami container...');
        await runAgentCommand(serverId, 'docker rm -f hylius-umami-app > /dev/null 2>&1 || true');
        await runAgentCommand(serverId, [
            `docker run -d`,
            `--name hylius-umami-app`,
            `--network hylius`,
            `--restart unless-stopped`,
            `-p ${UMAMI_PORT}:3000`,
            `-e DATABASE_URL=postgresql://umami:${dbPassword}@hylius-umami-db:5432/umami`,
            UMAMI_IMAGE,
        ].join(' '));

        // 5. Open firewall port
        log('Opening firewall port...');
        await runAgentCommand(serverId, `ufw allow ${UMAMI_PORT}/tcp > /dev/null 2>&1 || true`);

        // 6. Wait for Umami to be healthy (max 45s)
        log('Waiting for Umami to be healthy...');
        await runAgentCommand(serverId,
            `for i in $(seq 1 45); do curl -sf http://localhost:${UMAMI_PORT}/api/heartbeat > /dev/null 2>&1 && echo "HEALTHY" && break || sleep 1; done`
        );

        // 7. Get the server IP and construct the URL
        const server = await prisma.server.findUnique({ where: { id: serverId } });
        if (!server) throw new Error('Server not found');

        const umamiUrl = `http://${server.ip}:${UMAMI_PORT}`;

        // 8. Get API token from Umami (store so we never use raw credentials again)
        log('Generating Umami API token...');
        let apiToken = '';
        try {
            apiToken = await umamiLogin(umamiUrl, 'admin', 'umami');
        } catch (e: any) {
            log(`Warning: Could not fetch Umami API token: ${e.message}\n`);
        }

        // 9. Update the server record — mark as fully live
        await prisma.server.update({
            where: { id: serverId },
            data: {
                hasTrafficAnalytics: true,
                trafficAnalyticsUrl: umamiUrl,
                trafficAnalyticsToken: apiToken || null,
            } as any,
        });

        log(`✅ Umami deployed successfully at ${umamiUrl}`);
        log(`Default credentials: admin / umami`);

    } catch (error: any) {
        console.error(`[Umami] Deployment failed for server ${serverId}:`, error.message);
        // hasTrafficAnalytics was never set to true so nothing to roll back.
        // The flag stays false and the user can retry from the Marketplace.
        throw error;
    }
}

/**
 * Uninstall Umami from a server — full cleanup via the agent.
 * Stops containers, removes volumes, prunes images, closes firewall.
 */
export async function uninstallUmami(serverId: string): Promise<void> {
    console.log(`[Umami] Starting uninstall on server ${serverId}`);

    if (!agentGateway.isConnected(serverId)) {
        throw new Error('Agent is not connected. Please ensure the Hylius agent is running on your VPS.');
    }

    const log = (msg: string) => console.log(`[Umami:${serverId}] ${msg}`);

    try {
        // 1. Stop and remove Umami containers
        log('Stopping Umami containers...');
        await runAgentCommand(serverId, 'docker rm -f hylius-umami-app > /dev/null 2>&1 || true');
        await runAgentCommand(serverId, 'docker rm -f hylius-umami-db > /dev/null 2>&1 || true');

        // 2. Remove the Umami data volume
        log('Removing data volume...');
        await runAgentCommand(serverId, 'docker volume rm hylius-umami-data > /dev/null 2>&1 || true');

        // 3. Remove the Umami images
        log('Removing Docker images...');
        await runAgentCommand(serverId, `docker rmi ${UMAMI_IMAGE} > /dev/null 2>&1 || true`);
        await runAgentCommand(serverId, `docker rmi ${POSTGRES_IMAGE} > /dev/null 2>&1 || true`);

        // 4. Prune dangling images and unused volumes
        log('Pruning unused Docker resources...');
        await runAgentCommand(serverId, 'docker image prune -f > /dev/null 2>&1 || true');
        await runAgentCommand(serverId, 'docker volume prune -f > /dev/null 2>&1 || true');

        // 5. Close firewall port
        log('Closing firewall port...');
        await runAgentCommand(serverId, `ufw delete allow ${UMAMI_PORT}/tcp > /dev/null 2>&1 || true`);

        // 6. Reset server record
        await prisma.server.update({
            where: { id: serverId },
            data: {
                hasTrafficAnalytics: false,
                trafficAnalyticsUrl: null,
                trafficAnalyticsToken: null,
            } as any,
        });

        log('✅ Umami fully uninstalled and cleaned up');

    } catch (error: any) {
        console.error(`[Umami] Uninstall failed for server ${serverId}:`, error.message);
        throw error;
    }
}

/**
 * Run a shell command on the VPS via the agent gateway.
 */
async function runAgentCommand(serverId: string, cmd: string): Promise<string> {
    let output = '';
    await agentGateway.streamCommand(
        serverId,
        'exec',
        { cmd },
        (chunk: string) => { output += chunk; },
    );
    return output;
}
