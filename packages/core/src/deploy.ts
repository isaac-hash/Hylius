import { DeployOptions, DeployResult, ProjectConfig } from './types.js';
import { SSHClient } from './ssh/client.js';

async function execOrThrow(client: SSHClient, command: string, context: string): Promise<string> {
    const { stdout, stderr, code } = await client.exec(command);
    if (code !== 0) {
        throw new Error(`${context} failed (exit ${code}): ${stderr || stdout}`.trim());
    }
    return stdout;
}

async function execStreamOrThrow(
    client: SSHClient,
    command: string,
    context: string,
    onLog?: (chunk: string) => void,
): Promise<void> {
    const code = await client.execStream(command, onLog, onLog);
    if (code !== 0) {
        throw new Error(`${context} failed (exit ${code})`);
    }
}

async function resolveDeployStrategy(client: SSHClient, releasePath: string, project: ProjectConfig): Promise<'pm2' | 'docker-compose' | 'dockerfile'> {
    if (project.deployStrategy && project.deployStrategy !== 'auto') {
        return project.deployStrategy;
    }

    const composeFile = project.dockerComposeFile || 'compose.yaml';
    const { code: composeCode } = await client.exec(`test -f ${releasePath}/${composeFile}`);
    if (composeCode === 0) return 'docker-compose';

    const { code: dockerfileCode } = await client.exec(`test -f ${releasePath}/Dockerfile`);
    if (dockerfileCode === 0) return 'dockerfile';

    return 'pm2';
}

function getContainerName(project: ProjectConfig): string {
    return project.containerName || `${project.name}-app`;
}

export async function deploy(options: DeployOptions): Promise<DeployResult> {
    const { server, project, onLog } = options;
    const client = new SSHClient(server);
    const startTime = Date.now();

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

        log(`Creating release directory: ${releasePath}`);
        await execOrThrow(client, `mkdir -p ${releasePath}`, 'Create release directory');

        log(`Cloning ${project.repoUrl} (${project.branch || 'main'})...`);
        await execStreamOrThrow(
            client,
            `git clone -b ${project.branch || 'main'} --depth 1 ${project.repoUrl} ${releasePath}`,
            'Git clone',
            onLog,
        );

        const strategy = await resolveDeployStrategy(client, releasePath, project);
        log(`Deploy strategy: ${strategy}`);

        if (strategy === 'docker-compose') {
            const composeFile = project.dockerComposeFile || 'compose.yaml';
            log(`Running Docker Compose using ${composeFile}...`);
            await execStreamOrThrow(
                client,
                `cd ${releasePath} && docker compose -f ${composeFile} up -d --build --remove-orphans`,
                'Docker Compose deploy',
                onLog,
            );
            await execOrThrow(client, `ln -sfn ${releasePath} ${currentPath}`, 'Symlink switch');
        } else if (strategy === 'dockerfile') {
            const imageName = project.dockerImage || `${project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}:latest`;
            const containerName = getContainerName(project);
            const runCommand = project.dockerRunCommand || `docker run -d --name ${containerName} --restart unless-stopped ${imageName}`;

            log(`Building Docker image: ${imageName}`);
            await execStreamOrThrow(
                client,
                `cd ${releasePath} && docker build -t ${imageName} .`,
                'Docker build',
                onLog,
            );

            log(`Replacing container: ${containerName}`);
            await execStreamOrThrow(
                client,
                `docker rm -f ${containerName} >/dev/null 2>&1 || true && ${runCommand}`,
                'Docker run',
                onLog,
            );

            await execOrThrow(client, `ln -sfn ${releasePath} ${currentPath}`, 'Symlink switch');
        } else {
            log('Installing dependencies...');
            await execStreamOrThrow(client, `cd ${releasePath} && npm install --omit=dev`, 'Install dependencies', onLog);

            if (project.buildCommand) {
                log(`Running build: ${project.buildCommand}`);
                await execStreamOrThrow(client, `cd ${releasePath} && ${project.buildCommand}`, 'Project build', onLog);
            }

            log('Switching symlink...');
            await execOrThrow(client, `ln -sfn ${releasePath} ${currentPath}`, 'Symlink switch');

            log('Restarting application...');
            const restartCmd = project.startCommand
                ? `cd ${currentPath} && ${project.startCommand}`
                : `cd ${currentPath} && pm2 restart ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production`;

            await execStreamOrThrow(client, restartCmd, 'PM2 restart', onLog);
        }

        const commitHash = (await execOrThrow(client, `cd ${currentPath} && git rev-parse HEAD`, 'Read commit hash')).trim();
        const durationMs = Date.now() - startTime;
        log(`Deployment successful in ${durationMs}ms`);

        return {
            success: true,
            releaseId,
            commitHash,
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
