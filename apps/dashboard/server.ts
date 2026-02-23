/* eslint-disable no-console, @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any */
import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'node:http';
import next from 'next';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
// @ts-ignore - Local workspace package
import { deploy, setup, DeployOptions, ServerConfig, ProjectConfig, SetupOptions } from '@hylius/core';
import { decrypt } from './services/crypto.service';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 80;
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();
const prisma = new PrismaClient();

// Track active deployments to prevent concurrent duplicate calls or spam
const activeDeployments = new Set<string>();
const activeSetups = new Set<string>();

app.prepare().then(() => {
    const httpServer = createServer(handler);

    const io = new Server(httpServer);

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        // @ts-ignore
        socket.on('deploy', async (data: { projectId: string }) => {
            const { projectId } = data;
            console.log(`Received deploy request for project: ${projectId}`);

            if (activeDeployments.has(projectId)) {
                socket.emit('error', 'A deployment is already in progress for this project.');
                socket.emit('log', `\n\x1b[31mDeployment already in progress, please wait.\x1b[0m\n`);
                return;
            }
            activeDeployments.add(projectId);

            try {
                // 1. Fetch Project & Server Config
                const project = await prisma.project.findUnique({
                    where: { id: projectId },
                    include: { server: true }
                });

                if (!project) {
                    socket.emit('error', 'Project not found');
                    return;
                }

                // 2. Create Deployment Record
                // @ts-ignore
                const deployment = await prisma.deployment.create({
                    data: {
                        projectId: project.id,
                        status: 'PENDING',
                        triggerSource: 'DASHBOARD',
                        releaseId: 'pending',
                    }
                });

                socket.emit('deploy_start', { deploymentId: deployment.id });

                // 3. Prepare Core Config
                // Decrypt SSH key in-memory — key never leaves backend
                let privateKey = '';
                if (project.server.privateKeyEncrypted && project.server.keyIv) {
                    try {
                        privateKey = decrypt(project.server.privateKeyEncrypted, project.server.keyIv);
                    } catch (e) {
                        socket.emit('log', `Error decrypting SSH key: ${e}\n`);
                    }
                }

                const serverConfig: ServerConfig = {
                    // @ts-ignore
                    host: project.server.ip,
                    port: project.server.port,
                    username: project.server.username,
                    privateKey: privateKey, // Decrypted in-memory, never persisted
                };

                const projectConfig: ProjectConfig = {
                    name: project.name,
                    repoUrl: project.repoUrl,
                    branch: project.branch,
                    deployPath: project.deployPath,
                    // TODO: Add build/start commands from DB
                };

                // 4. Execute Deployment
                socket.emit('log', `\x1b[36mStarting deployment for ${project.name}...\x1b[0m\n`);

                const result = await deploy({
                    server: serverConfig,
                    project: projectConfig,
                    trigger: 'dashboard',
                    onLog: (chunk) => {
                        socket.emit('log', chunk);
                        // TODO: stream to file or DB buffer
                    }
                });

                // 5. Update Status
                // @ts-ignore
                await prisma.deployment.update({
                    where: { id: deployment.id },
                    data: {
                        status: result.success ? 'SUCCESS' : 'FAILED',
                        releaseId: result.releaseId,
                        durationMs: result.durationMs,
                        commitHash: result.commitHash,
                        finishedAt: new Date(),
                    }
                });

                if (result.success) {
                    socket.emit('deploy_success', result);
                    socket.emit('log', `\n\x1b[32mDeployment Successful! Release: ${result.releaseId}\x1b[0m\n`);
                } else {
                    socket.emit('deploy_error', result.error);
                    socket.emit('log', `\n\x1b[31mDeployment Failed: ${result.error}\x1b[0m\n`);
                }

            } catch (error: any) {
                console.error('Deployment error:', error);
                socket.emit('error', error.message);
                socket.emit('log', `\n\x1b[31mSystem Error: ${error.message}\x1b[0m\n`);
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
                    privateKey: privateKey,
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

            } catch (error: any) {
                console.error('Setup error:', error);
                socket.emit('error', error.message);
                socket.emit('log', `\n\x1b[31mSystem Error: ${error.message}\x1b[0m\n`);
            } finally {
                activeSetups.delete(serverId);
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
