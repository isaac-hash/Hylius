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

type ProjectRuntime = 'next' | 'vite' | 'node' | 'python' | 'fastapi' | 'go' | 'java' | 'php' | 'laravel';

async function detectRuntimeFromRailpack(client: SSHClient, releasePath: string): Promise<ProjectRuntime | null> {
    const { stdout, code } = await client.exec(`cd ${releasePath} && railpack plan --json`);
    if (code !== 0 || !stdout.trim()) {
        return null;
    }

    try {
        const plan = JSON.parse(stdout) as { providers?: string[]; variables?: Record<string, string> };
        if (!plan.providers || plan.providers.length === 0) {
            return null;
        }

        const providers = plan.providers.map(provider => provider.toLowerCase());
        if (providers.includes('nextjs')) return 'next';
        if (providers.includes('node')) {
            if (await hasFile(client, `${releasePath}/vite.config.ts`) || await hasFile(client, `${releasePath}/vite.config.js`)) {
                return 'vite';
            }

            return 'node';
        }

        if (providers.includes('python')) {
            if (plan.variables?.RAILPACK_PYTHON_APP_MODULE?.includes('main:app')) return 'fastapi';
            return 'python';
        }

        if (providers.includes('php')) {
            if (await hasFile(client, `${releasePath}/artisan`)) return 'laravel';
            return 'php';
        }

        if (providers.includes('go')) return 'go';
        if (providers.includes('java')) return 'java';

        return null;
    } catch {
        return null;
    }
}

async function detectRuntimeFromFiles(client: SSHClient, releasePath: string): Promise<ProjectRuntime | null> {
    if (await hasFile(client, `${releasePath}/package.json`)) {
        const { code: nextCode } = await client.exec(`grep -q '"next"' ${releasePath}/package.json`);
        if (nextCode === 0) {
            return 'next';
        }

        if (await hasFile(client, `${releasePath}/vite.config.ts`) || await hasFile(client, `${releasePath}/vite.config.js`)) {
            return 'vite';
        }

        return 'node';
    }

    if (await hasFile(client, `${releasePath}/requirements.txt`) || await hasFile(client, `${releasePath}/pyproject.toml`)) {
        if (await hasFile(client, `${releasePath}/main.py`)) {
            const { code: fastApiCode } = await client.exec(`grep -q 'FastAPI' ${releasePath}/main.py`);
            if (fastApiCode === 0) {
                return 'fastapi';
            }
        }

        return 'python';
    }
}

async function detectRuntimeFromFiles(client: SSHClient, appPath: string): Promise<ProjectRuntime | null> {
    if (await hasFile(client, `${appPath}/package.json`)) {
        const { code: nextCode } = await client.exec(`grep -q '"next"' ${appPath}/package.json`);
        if (nextCode === 0) {
            return 'next';
        }

        if (await hasFile(client, `${appPath}/vite.config.ts`) || await hasFile(client, `${appPath}/vite.config.js`)) {
            return 'vite';
        }

        return 'node';
    }

    if (await hasFile(client, `${appPath}/requirements.txt`) || await hasFile(client, `${appPath}/pyproject.toml`)) {
        if (await hasFile(client, `${appPath}/main.py`)) {
            const { code: fastApiCode } = await client.exec(`grep -q 'FastAPI' ${appPath}/main.py`);
            if (fastApiCode === 0) {
                return 'fastapi';
            }
        }

        return 'python';
    }

    if (await hasFile(client, `${releasePath}/composer.json`)) {
        if (await hasFile(client, `${releasePath}/artisan`)) return 'laravel';
        return 'php';
    }

    if (await hasFile(client, `${releasePath}/go.mod`)) return 'go';
    if (await hasFile(client, `${releasePath}/pom.xml`)) return 'java';

    return null;
}

async function detectProjectRuntime(client: SSHClient, releasePath: string): Promise<ProjectRuntime | null> {
    const railpackRuntime = await detectRuntimeFromRailpack(client, releasePath);
    if (railpackRuntime) {
        return railpackRuntime;
    }

    return detectRuntimeFromFiles(client, releasePath);
}

function getGeneratedDockerfile(runtime: ProjectRuntime): string {
    switch (runtime) {
        case 'next':
            return `FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
`;
        case 'vite':
        case 'node':
            return `FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
`;
        case 'fastapi':
            return `FROM python:3.12-slim
WORKDIR /app
COPY requirements*.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
`;
        case 'python':
            return `FROM python:3.12-slim
WORKDIR /app
COPY requirements*.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "main.py"]
`;
        case 'go':
            return `FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN go build -o app .

FROM alpine:3.20
WORKDIR /app
COPY --from=builder /app/app /app/app
EXPOSE 8080
CMD ["/app/app"]
`;
        case 'java':
            return `FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY pom.xml ./
COPY src ./src
RUN mvn -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=builder /app/target/*.jar /app/app.jar
EXPOSE 8080
CMD ["java", "-jar", "/app/app.jar"]
`;
        case 'laravel':
            return `FROM php:8.3-apache
WORKDIR /var/www/html
RUN docker-php-ext-install pdo pdo_mysql
COPY . .
EXPOSE 80
CMD ["apache2-foreground"]
`;
        case 'php':
            return `FROM php:8.3-apache
WORKDIR /var/www/html
COPY . .
EXPOSE 80
CMD ["apache2-foreground"]
`;
    }
}

function getGeneratedCompose(project: ProjectConfig, runtime: ProjectRuntime): string {
    const imageName = project.dockerImage || `${project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}:latest`;
    const containerName = project.containerName || `${project.name}-app`;
    const appPort = runtime === 'python' || runtime === 'fastapi' ? '8000:8000' : runtime === 'php' || runtime === 'laravel' ? '80:80' : '3000:3000';

    return `services:\n  app:\n    build:\n      context: .\n    image: ${imageName}\n    container_name: ${containerName}\n    restart: unless-stopped\n    ports:\n      - \"${appPort}\"\n`;
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

    const runtime = await detectProjectRuntime(client, releasePath);
    if (!runtime) {
        return;
    }

    const { runtime, appPath } = detected;
    const contextPath = appPath === releasePath ? '.' : appPath.replace(`${releasePath}/`, './');

    const dockerfileContent = getGeneratedDockerfile(runtime).replace(/'/g, `'"'"'`);
    const composeContent = getGeneratedCompose(project, runtime).replace(/'/g, `'"'"'`);

    if (onLog) onLog(`No Docker artifacts found. Generating ${runtime.toUpperCase()} Dockerfile and ${composeFile}...\n`);

    await execOrThrow(
        client,
        `cat <<'EOF' > ${appPath}/Dockerfile\n${dockerfileContent}EOF`,
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

        if (project.repoUrl === 'local' && project.localBundlePath) {
            log(`Extracting local bundle from ${project.localBundlePath}...`);
            await execStreamOrThrow(
                client,
                `tar -xzf ${project.localBundlePath} -C ${releasePath} --strip-components=1`,
                'Extract bundle',
                onLog,
            );
            // Optionally remove the bundle after extraction
            await client.exec(`rm ${project.localBundlePath}`);
        } else {
            log(`Cloning ${project.repoUrl} (${project.branch || 'main'})...`);
            await execStreamOrThrow(
                client,
                `git clone -b ${project.branch || 'main'} --depth 1 ${project.repoUrl} ${releasePath}`,
                'Git clone',
                onLog,
            );
        }

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
