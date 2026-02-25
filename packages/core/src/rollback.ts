import { RollbackOptions, DeployResult } from './types.js';
import { SSHClient } from './ssh/client.js';

export async function rollback(options: RollbackOptions): Promise<DeployResult> {
    const { server, project, releaseId } = options;
    const client = new SSHClient(server);
    const startTime = Date.now();
    const targetReleasePath = `${project.deployPath}/releases/${releaseId}`;
    const currentPath = `${project.deployPath}/current`;

    try {
        await client.connect();

        // check if release exists
        const check = await client.exec(`if [ -d "${targetReleasePath}" ]; then echo "exists"; fi`);
        if (!check.stdout.includes('exists')) {
            throw new Error(`Release ${releaseId} not found at ${targetReleasePath}`);
        }

        // Switch symlink
        await client.exec(`ln -sfn ${targetReleasePath} ${currentPath}`);

        // Restart
        const restartCmd = `cd ${currentPath} && pm2 restart ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production`;
        await client.execStream(restartCmd); // Output ignored for now

        return {
            success: true,
            releaseId,
            durationMs: Date.now() - startTime
        };

    } catch (err: any) {
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
