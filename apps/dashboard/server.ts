/* eslint-disable no-console, @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */
import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'node:http';
import next from 'next';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
// @ts-ignore - Local workspace package
import { setup, ServerConfig, SetupOptions, SSHClient } from '@hylius/core';
import { decrypt } from './services/crypto.service';
import { executeDeployment } from './services/deploy.service';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = 80;
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();
const prisma = new PrismaClient();

// Track active deployments to prevent concurrent duplicate calls or spam
const activeDeployments = new Set<string>();
const activeSetups = new Set<string>();

// Track active log streams: projectId → SSHClient (so we can destroy on unwatch/disconnect)
const activeLogStreams = new Map<string, SSHClient>();

app.prepare().then(() => {
    const httpServer = createServer(handler);

    const io = new Server(httpServer);
    (global as any).io = io; // Expose globally for API routes (e.g. webhooks)

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        // @ts-ignore
        socket.on('deploy', async (data: { projectId: string }) => {
            const { projectId } = data;
            console.log(`Received deploy request for project: ${projectId}`);

            if (activeDeployments.has(projectId)) {
                socket.emit(`error:${projectId}`, 'A deployment is already in progress for this project.');
                socket.emit(`log:${projectId}`, `\n\x1b[31mDeployment already in progress, please wait.\x1b[0m\n`);
                return;
            }
            activeDeployments.add(projectId);

            try {
                // Emit an initial deploy_start so UI knows it started
                socket.emit(`deploy_start:${projectId}`, { deploymentId: 'pending' });

                const result = await executeDeployment({
                    projectId,
                    trigger: 'dashboard',
                    onLog: (chunk) => {
                        socket.emit(`log:${projectId}`, chunk);
                    },
                });

                if (result.success) {
                    socket.emit(`deploy_success:${projectId}`, result);
                    socket.emit(`log:${projectId}`, `\n\x1b[32mDeployment Successful! Release: ${result.releaseId}\x1b[0m\n`);
                } else {
                    socket.emit(`deploy_error:${projectId}`, result.error);
                    socket.emit(`log:${projectId}`, `\n\x1b[31mDeployment Failed: ${result.error}\x1b[0m\n`);
                }

            } catch (error: any) {
                console.error('Deployment error:', error);
                socket.emit(`error:${projectId}`, error.message);
                socket.emit(`log:${projectId}`, `\n\x1b[31mSystem Error: ${error.message}\x1b[0m\n`);
            } finally {
                activeDeployments.delete(projectId);
            }
        });

        socket.on('setup-server', async (data: { serverId: string }) => {
            const { serverId } = data;
            console.log(`Received setup request for server: ${serverId}`);

            if (activeSetups.has(serverId)) {
                socket.emit('error', 'A setup is already in progress for this server.');
                socket.emit('log', `\n\x1b[31mSetup already in progress, please wait.\x1b[0m\n`);
                return;
            }
            activeSetups.add(serverId);

            try {
                // 1. Fetch Server Config
                const serverRecord = await prisma.server.findUnique({
                    where: { id: serverId },
                });

                if (!serverRecord) {
                    socket.emit('error', 'Server not found');
                    return;
                }

                socket.emit('setup_start', { serverId: serverRecord.id });

                // Audit Log
                await prisma.auditLog.create({
                    data: {
                        action: 'SERVER_PROVISION_STARTED',
                        organizationId: serverRecord.organizationId,
                        metadata: JSON.stringify({ serverId: serverRecord.id, name: serverRecord.name })
                    }
                });

                // 2. Prepare Core Config
                let privateKey = '';
                if (serverRecord.privateKeyEncrypted && serverRecord.keyIv) {
                    try {
                        privateKey = decrypt(serverRecord.privateKeyEncrypted, serverRecord.keyIv);
                    } catch (e) {
                        socket.emit('log', `Error decrypting SSH key: ${e}\n`);
                    }
                }

                const serverConfig: ServerConfig = {
                    host: serverRecord.ip,
                    port: serverRecord.port,
                    username: serverRecord.username,
                    privateKey: privateKey.includes('BEGIN') ? privateKey : undefined,
                    password: privateKey && !privateKey.includes('BEGIN') ? privateKey : undefined,
                };

                // 3. Execute Setup
                socket.emit('log', `\x1b[36mStarting provisioning for ${serverRecord.name}...\x1b[0m\n`);

                const result = await setup({
                    server: serverConfig,
                    onLog: (chunk) => {
                        socket.emit('log', chunk);
                    }
                });

                if (result.success) {
                    socket.emit('setup_success', result);
                } else {
                    socket.emit('setup_error', result.error);
                }

                // Audit Log Completion
                await prisma.auditLog.create({
                    data: {
                        action: result.success ? 'SERVER_PROVISION_COMPLETED' : 'SERVER_PROVISION_FAILED',
                        organizationId: serverRecord.organizationId,
                        metadata: JSON.stringify({
                            serverId: serverRecord.id,
                            name: serverRecord.name,
                            error: result.error
                        })
                    }
                });

            } catch (error: any) {
                console.error('Setup error:', error);
                socket.emit('error', error.message);
                socket.emit('log', `\n\x1b[31mSystem Error: ${error.message}\x1b[0m\n`);
            } finally {
                activeSetups.delete(serverId);
            }
        });

        // ─── watch-logs: stream runtime logs from the VPS ────────────────────
        socket.on('watch-logs', async (data: { projectId: string }) => {
            const { projectId } = data;

            // Prevent duplicate stream for same project
            if (activeLogStreams.has(projectId)) {
                socket.emit(`logs:connected:${projectId}`);
                return;
            }

            try {
                const project = await prisma.project.findUnique({
                    where: { id: projectId },
                    include: { server: true },
                });

                if (!project) {
                    socket.emit(`logs:error:${projectId}`, 'Project not found');
                    return;
                }

                let privateKey = '';
                if (project.server.privateKeyEncrypted && project.server.keyIv) {
                    privateKey = decrypt(project.server.privateKeyEncrypted, project.server.keyIv);
                }

                const sshClient = new SSHClient({
                    // @ts-ignore
                    host: project.server.ip,
                    port: project.server.port,
                    username: project.server.username,
                    privateKey: privateKey.includes('BEGIN') ? privateKey : undefined,
                    password: privateKey && !privateKey.includes('BEGIN') ? privateKey : undefined,
                });

                await sshClient.connect();
                activeLogStreams.set(projectId, sshClient);
                socket.emit(`logs:connected:${projectId}`);

                const containerName = `${project.name}-app`;  // mirrors deploy.ts getContainerName()

                // Try docker logs --follow first; if it fails (container not found), fall back to PM2
                const { code: dockerCheck } = await sshClient.exec(
                    `docker inspect ${containerName} --format='{{.State.Running}}' 2>/dev/null`
                );

                const logCommand = dockerCheck === 0
                    ? `docker logs --tail 100 --follow ${containerName} 2>&1`
                    : `pm2 logs ${project.name} --nocolor --lines 100 2>&1`;

                // execStream keeps the SSH connection open and fires callbacks per chunk
                sshClient.execStream(
                    logCommand,
                    (chunk: string) => socket.emit(`logs:data:${projectId}`, chunk),
                    (chunk: string) => socket.emit(`logs:data:${projectId}`, chunk),
                ).then(() => {
                    socket.emit(`logs:closed:${projectId}`);
                    activeLogStreams.delete(projectId);
                    sshClient.end();
                }).catch((err: Error) => {
                    socket.emit(`logs:error:${projectId}`, err.message);
                    activeLogStreams.delete(projectId);
                    sshClient.end();
                });

            } catch (err: any) {
                console.error('[watch-logs] error:', err);
                socket.emit(`logs:error:${projectId}`, err.message || 'SSH connection failed');
                activeLogStreams.delete(projectId);
            }
        });

        // ─── unwatch-logs: client explicitly closes the log stream ───────────
        socket.on('unwatch-logs', (data: { projectId: string }) => {
            const { projectId } = data;
            const sshClient = activeLogStreams.get(projectId);
            if (sshClient) {
                sshClient.end();
                activeLogStreams.delete(projectId);
            }
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });

    httpServer
        .once('error', (err) => {
            console.error(err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`> Ready on http://${hostname}:${port}`);
        });
});
