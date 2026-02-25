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

async function hasFile(client: SSHClient, filePath: string): Promise<boolean> {
    const { code } = await client.exec(`test -f ${filePath}`);
    return code === 0;
}

async function detectNodeRuntime(client: SSHClient, releasePath: string): Promise<'next' | 'node' | null> {
    if (!(await hasFile(client, `${releasePath}/package.json`))) {
        return null;
    }

    const { code: nextCode } = await client.exec(`grep -q '"next"' ${releasePath}/package.json`);
    if (nextCode === 0) {
        return 'next';
    }

    return 'node';
}

function getGeneratedDockerfile(runtime: 'next' | 'node'): string {
    if (runtime === 'next') {
        return `FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
`;
    }

    return `FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
`;
}

function getGeneratedCompose(project: ProjectConfig): string {
    const imageName = project.dockerImage || `${project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}:latest`;
    const containerName = project.containerName || `${project.name}-app`;

    return `services:\n  app:\n    build:\n      context: .\n    image: ${imageName}\n    container_name: ${containerName}\n    restart: unless-stopped\n    ports:\n      - \"3000:3000\"\n`;
}

async function scaffoldContainerFilesIfNeeded(
    client: SSHClient,
    releasePath: string,
    project: ProjectConfig,
    onLog?: (chunk: string) => void,
): Promise<void> {
    if (project.deployStrategy && project.deployStrategy !== 'auto') {
        return;
    }

    const composeFile = project.dockerComposeFile || 'compose.yaml';

    if (await hasFile(client, `${releasePath}/${composeFile}`) || await hasFile(client, `${releasePath}/Dockerfile`)) {
        return;
    }

    const runtime = await detectNodeRuntime(client, releasePath);
    if (!runtime) {
        return;
    }

    const dockerfileContent = getGeneratedDockerfile(runtime).replace(/'/g, `'"'"'`);
    const composeContent = getGeneratedCompose(project).replace(/'/g, `'"'"'`);

    if (onLog) onLog(`No Docker artifacts found. Generating ${runtime.toUpperCase()} Dockerfile and ${composeFile}...\n`);

    await execOrThrow(
        client,
        `cat <<'EOF' > ${releasePath}/Dockerfile\n${dockerfileContent}EOF`,
        'Generate Dockerfile',
    );

    await execOrThrow(
        client,
        `cat <<'EOF' > ${releasePath}/${composeFile}\n${composeContent}EOF`,
        `Generate ${composeFile}`,
    );
}

async function resolveDeployStrategy(client: SSHClient, releasePath: string, project: ProjectConfig): Promise<'pm2' | 'docker-compose' | 'dockerfile'> {
    if (project.deployStrategy && project.deployStrategy !== 'auto') {
        return project.deployStrategy;
    }

    const composeFile = project.dockerComposeFile || 'compose.yaml';
    if (await hasFile(client, `${releasePath}/${composeFile}`)) return 'docker-compose';

    if (await hasFile(client, `${releasePath}/Dockerfile`)) return 'dockerfile';

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

        await scaffoldContainerFilesIfNeeded(client, releasePath, project, onLog);

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
