import { DeployOptions, DeployResult, ServerConfig, ProjectConfig } from './types.js';
import { SSHClient } from './ssh/client.js';

export async function deploy(options: DeployOptions): Promise<DeployResult> {
    const { server, project, onLog } = options;
    const client = new SSHClient(server);
    const startTime = Date.now();

    // 1. Generate Release ID (YYYYMMDD-HHMMSS)
    const date = new Date();
    const releaseId = date.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const releasePath = `${project.deployPath}/releases/${releaseId}`;
    const currentPath = `${project.deployPath}/current`;

    const log = (msg: string) => {
        if (onLog) onLog(msg + '\n');
    };

    try {
        log(`[${releaseId}] Connecting to ${server.host}...`);
        await client.connect();

        // 2. Create Release Directory
        log(`Creating release directory: ${releasePath}`);
        await client.exec(`mkdir -p ${releasePath}`);

        // 3. Clone Repository (Simplistic for now, assumes public or auth configured)
        log(`Cloning ${project.repoUrl} (${project.branch || 'main'})...`);
        await client.execStream(
            `git clone -b ${project.branch || 'main'} --depth 1 ${project.repoUrl} ${releasePath}`,
            onLog,
            onLog
        );

        // 4. Install Dependencies
        log('Installing dependencies...');
        await client.execStream(`cd ${releasePath} && npm install --omit=dev`, onLog, onLog); // Optimize for prod

        // 5. Build (if configured)
        if (project.buildCommand) {
            log(`Running build: ${project.buildCommand}`);
            await client.execStream(`cd ${releasePath} && ${project.buildCommand}`, onLog, onLog);
        }

        // 6. Atomic Switch (Symlink)
        log('Switching symlink...');
        // ln -sfn forces update of symlink
        await client.exec(`ln -sfn ${releasePath} ${currentPath}`);

        // 7. Restart PM2
        log('Restarting application...');
        // Assumes ecosystem.config.js is in root or handled by command
        const restartCmd = project.startCommand
            ? `cd ${currentPath} && ${project.startCommand}`
            : `cd ${currentPath} && pm2 restart ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production`;

        await client.execStream(restartCmd, onLog, onLog);

        // 8. Get Commit Hash
        const { stdout: commitHash } = await client.exec(`cd ${currentPath} && git rev-parse HEAD`);

        const durationMs = Date.now() - startTime;
        log(`Deployment successful in ${durationMs}ms`);

        return {
            success: true,
            releaseId,
            commitHash: commitHash.trim(),
            durationMs
        };

    } catch (err: any) {
        log(`Deployment failed: ${err.message}`);
        return {
            success: false,
            releaseId,
            durationMs: Date.now() - startTime,
            error: err.message
        };
    } finally {
        client.end();
    }
}
