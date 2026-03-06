import { DeployOptions, DeployResult, ProjectConfig, DomainConfig } from './types.js';
import { SSHClient } from './ssh/client.js';
import { configureCaddy, ensureCaddyRunning } from './domain.js';

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
    let lastErrorChunk = '';
    const code = await client.execStream(command, onLog, (errChunk) => {
        lastErrorChunk += errChunk;
        if (onLog) onLog(errChunk);
    });
    if (code !== 0) {
        throw new Error(`${context} failed (exit ${code}): ${lastErrorChunk}`.trim());
    }
}

async function hasFile(client: SSHClient, filePath: string): Promise<boolean> {
    const { code } = await client.exec(`test -f ${filePath}`);
    return code === 0;
}

type ProjectRuntime = 'next' | 'vite' | 'node' | 'python' | 'fastapi' | 'go' | 'java' | 'php' | 'laravel';

/**
 * Detect runtime using railpack plan --json (for port mapping only).
 */
async function detectRuntime(client: SSHClient, releasePath: string): Promise<ProjectRuntime | null> {
    const { stdout, code } = await client.exec(`cd ${releasePath} && railpack plan --json`);
    if (code !== 0 || !stdout.trim()) {
        return null;
    }

    try {
        const plan = JSON.parse(stdout) as { providers?: string[]; variables?: Record<string, string> };
        if (!plan.providers || plan.providers.length === 0) {
            return null;
        }

        const providers = plan.providers.map(p => p.toLowerCase());
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

/**
 * Get the default port for a detected runtime.
 */
function getRuntimePort(runtime: ProjectRuntime | null): string {
    switch (runtime) {
        case 'python':
        case 'fastapi':
            return '8000';
        case 'go':
        case 'java':
            return '8080';
        case 'php':
        case 'laravel':
            return '80';
        case 'next':
        case 'vite':
        case 'node':
        default:
            return '3000';
    }
}

type DeployStrategy = 'docker-compose' | 'dockerfile' | 'railpack' | 'nixpacks' | 'pm2' | 'ghcr-pull';

/**
 * Determine how to deploy the project based on existing files or explicit config.
 */
async function resolveDeployStrategy(client: SSHClient, releasePath: string, project: ProjectConfig): Promise<DeployStrategy> {
    // Explicit user override (skip 'auto')
    if (project.deployStrategy && project.deployStrategy !== 'auto') {
        return project.deployStrategy;
    }

    // Check for existing containerization artifacts
    const composeFile = project.dockerComposeFile || 'compose.yaml';
    if (await hasFile(client, `${releasePath}/${composeFile}`)) return 'docker-compose';
    if (await hasFile(client, `${releasePath}/docker-compose.yml`)) return 'docker-compose';
    if (await hasFile(client, `${releasePath}/Dockerfile`)) return 'dockerfile';
    if (await hasFile(client, `${releasePath}/nixpacks.toml`)) return 'nixpacks';
    if (await hasFile(client, `${releasePath}/railpack.json`)) return 'railpack';

    // Not containerized — check if railpack is available on the server
    const { code: railpackCheck } = await client.exec('command -v railpack');
    if (railpackCheck === 0) return 'railpack';

    // Fallback to PM2 (no containerization)
    return 'pm2';
}

function getContainerName(project: ProjectConfig): string {
    return project.containerName || `${project.name}-app`;
}

function getImageName(project: ProjectConfig): string {
    return project.dockerImage || `${project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}:latest`;
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

    let finalUrl: string | undefined;

    try {
        log(`[${releaseId}] Connecting to ${server.host}...`);
        await client.connect();

        log(`Creating release directory: ${releasePath}`);
        await execOrThrow(client, `mkdir -p ${releasePath}`, 'Create release directory');

        let strategy: DeployStrategy | null = project.deployStrategy && project.deployStrategy !== 'auto'
            ? (project.deployStrategy as DeployStrategy)
            : null;

        if (strategy !== 'ghcr-pull') {
            if (project.repoUrl === 'local' && project.localBundlePath) {
                log(`Extracting local bundle from ${project.localBundlePath}...`);
                await execStreamOrThrow(
                    client,
                    `tar -xzf ${project.localBundlePath} -C ${releasePath} --strip-components=1`,
                    'Extract bundle',
                    onLog,
                );
                // Remove the bundle after extraction
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
        }

        if (!strategy) {
            strategy = await resolveDeployStrategy(client, releasePath, project);
        }
        log(`Deploy strategy: ${strategy}`);

        if (strategy === 'docker-compose') {
            const composeFile = project.dockerComposeFile || 'compose.yaml';

            // Patch compose target from development to production for server deployments
            log('Patching compose target to production...');
            await client.exec(
                `cd ${releasePath} && sed -i 's/target: development/target: production/g' ${composeFile}`
            );

            log(`Running Docker Compose using ${composeFile}...`);
            await execStreamOrThrow(
                client,
                `cd ${releasePath} && docker compose -f ${composeFile} up -d --build --remove-orphans`,
                'Docker Compose deploy',
                onLog,
            );
            await execOrThrow(client, `ln -sfn ${releasePath} ${currentPath}`, 'Symlink switch');

        } else if (strategy === 'ghcr-pull') {
            const image = project.ghcrImage;
            if (!image) throw new Error("ghcrImage is required for the ghcr-pull deploy strategy.");

            const containerName = getContainerName(project);

            log(`Pulling pre-built image: ${image}`);
            await execStreamOrThrow(client, `docker pull ${image}`, 'Docker pull', onLog);

            // Find a free port starting from 3011 (since 3000-3010 are pre-bound by the Mock VPS)
            log(`Finding a free port...`);
            let port = '3011';
            try {
                // Iteratively check ports starting from 3011 using Node.js loop over SSH
                for (let p = 3011; p <= 3100; p++) {
                    const { stdout: portStr } = await client.exec(
                        `docker ps --format '{{.Ports}}' | grep -q ":${p}->" || echo "FREE"`
                    );
                    if (portStr.trim() === 'FREE') {
                        port = p.toString();
                        break;
                    }
                }
            } catch (e: any) {
                log(`Failed to find dynamic port, falling back to 3011: ${e.message}`);
            }

            log(`Assigning port ${port} and replacing container: ${containerName}`);
            await execStreamOrThrow(
                client,
                `docker rm -f ${containerName} >/dev/null 2>&1 || true && \
                 docker run -d --name ${containerName} --restart unless-stopped -p ${port}:3000 ${image}`,
                'Docker run',
                onLog,
            );

            await execOrThrow(client, `ln -sfn ${releasePath} ${currentPath}`, 'Symlink switch');

        } else if (strategy === 'dockerfile') {
            const imageName = getImageName(project);
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

        } else if (strategy === 'railpack') {
            const imageName = getImageName(project);
            const containerName = getContainerName(project);

            // Detect runtime for port mapping
            log('Detecting project runtime...');
            const runtime = await detectRuntime(client, releasePath);
            const port = getRuntimePort(runtime);
            log(`Detected runtime: ${runtime || 'unknown'} (port ${port})`);

            // Build with Railpack — it auto-detects everything and sets the start command
            log(`Building container image with Railpack: ${imageName}`);
            await execStreamOrThrow(
                client,
                `cd ${releasePath} && railpack build . --name ${imageName}`,
                'Railpack build',
                onLog,
            );

            // Stop old container and run the new image
            log(`Replacing container: ${containerName}`);
            await execStreamOrThrow(
                client,
                `docker rm -f ${containerName} >/dev/null 2>&1 || true && docker run -d --name ${containerName} --restart unless-stopped -p ${port}:${port} ${imageName}`,
                'Docker run',
                onLog,
            );

            await execOrThrow(client, `ln -sfn ${releasePath} ${currentPath}`, 'Symlink switch');

        } else if (strategy === 'nixpacks') {
            const imageName = getImageName(project);
            const containerName = getContainerName(project);

            // Detect runtime for port mapping
            log('Detecting project runtime...');
            const runtime = await detectRuntime(client, releasePath);
            const port = getRuntimePort(runtime);
            log(`Detected runtime: ${runtime || 'unknown'} (port ${port})`);

            // Build with Nixpacks
            log(`Building container image with Nixpacks: ${imageName}`);
            await execStreamOrThrow(
                client,
                `cd ${releasePath} && nixpacks build . --name ${imageName}`,
                'Nixpacks build',
                onLog,
            );

            // Stop old container and run the new image
            log(`Replacing container: ${containerName}`);
            await execStreamOrThrow(
                client,
                `docker rm -f ${containerName} >/dev/null 2>&1 || true && docker run -d --name ${containerName} --restart unless-stopped -p ${port}:${port} ${imageName}`,
                'Docker run',
                onLog,
            );

            await execOrThrow(client, `ln -sfn ${releasePath} ${currentPath}`, 'Symlink switch');

        } else {
            // PM2 strategy (no containerization)

            // Detect package manager
            let pkgManager = 'npm';
            log('Detecting package manager...');
            if (await hasFile(client, `${releasePath}/pnpm-lock.yaml`)) {
                pkgManager = 'pnpm';
            } else if (await hasFile(client, `${releasePath}/yarn.lock`)) {
                pkgManager = 'yarn';
            }
            log(`Detected package manager: ${pkgManager}`);

            log(`Installing dependencies using ${pkgManager}...`);
            await execStreamOrThrow(client, `cd ${releasePath} && ${pkgManager} install`, 'Install dependencies', onLog);

            // Determine build command: use explicit or auto-detect from package.json
            let buildCmd = project.buildCommand;
            log(`Build command from config: "${buildCmd || '(none)'}"`);
            if (!buildCmd) {
                try {
                    const { stdout: pkgStr } = await client.exec(`cat ${releasePath}/package.json`);
                    if (pkgStr) {
                        const pkg = JSON.parse(pkgStr);
                        if (pkg.scripts?.build) {
                            buildCmd = `${pkgManager} run build`;
                            log(`Auto-detected build script in package.json`);
                        } else {
                            log(`No build script found in package.json`);
                        }
                    }
                } catch (e: any) {
                    log(`Failed to read package.json for build detection: ${e.message}`);
                }
            }

            if (buildCmd) {
                log(`Running build: ${buildCmd}`);
                await execStreamOrThrow(client, `cd ${releasePath} && ${buildCmd}`, 'Project build', onLog);
            } else {
                log('No build command to run, skipping build step');
            }

            log('Switching symlink...');
            await execOrThrow(client, `ln -sfn ${releasePath} ${currentPath}`, 'Symlink switch');

            log('Restarting application...');
            let startScript = 'start';
            let extraArgs = '';
            try {
                const { stdout: packageJsonStr } = await client.exec(`cat ${currentPath}/package.json`);
                if (packageJsonStr) {
                    const pkg = JSON.parse(packageJsonStr);
                    const isVite = pkg.dependencies?.vite || pkg.devDependencies?.vite;

                    if (pkg.scripts) {
                        if (pkg.scripts.start) startScript = 'start';
                        else if (pkg.scripts.preview) {
                            startScript = 'run preview';
                            if (isVite) extraArgs = ' -- --host 0.0.0.0 --port 3000';
                        }
                        else if (pkg.scripts.dev) {
                            startScript = 'run dev';
                            if (isVite) extraArgs = ' -- --host 0.0.0.0 --port 3000';
                        }
                    }
                }
            } catch (e) {
                // Ignore parse errors, fallback to default 'start'
            }

            // Delete old PM2 process first to fully clear stale log history
            await client.exec(`pm2 delete "${project.name}" > /dev/null 2>&1 || true`);

            // Detect runtime early so we know the expected port for cleanup
            const runtime = await detectRuntime(client, releasePath);
            const defaultPort = getRuntimePort(runtime);

            // Wait for the old process to fully release its port, then kill
            // any lingering child process that might still hold the port
            await new Promise(res => setTimeout(res, 1500));
            await client.exec(`fuser -k ${defaultPort}/tcp > /dev/null 2>&1 || true`);
            // Also kill common Vite default port that may linger from previous deploys
            if (defaultPort !== '4173') {
                await client.exec(`fuser -k 4173/tcp > /dev/null 2>&1 || true`);
            }
            await new Promise(res => setTimeout(res, 500));

            const restartCmd = project.startCommand
                ? `cd ${currentPath} && ${project.startCommand}`
                : `cd ${currentPath} && (test -f ecosystem.config.js && pm2 start ecosystem.config.js --env production || pm2 start ${pkgManager} --name "${project.name}" -- ${startScript}${extraArgs})`;

            await execStreamOrThrow(client, restartCmd, 'PM2 restart', onLog);

            // --- Detect the actual listening port ---
            let appPort = '';

            // Method 1: Check actual listening port via ss (most reliable)
            for (let attempt = 0; attempt < 4 && !appPort; attempt++) {
                await new Promise(res => setTimeout(res, 2000));
                try {
                    const { stdout: pidStr } = await client.exec(`pm2 pid "${project.name}" 2>/dev/null`);
                    const pid = pidStr.trim();
                    if (pid && pid !== '0') {
                        // Check both the PM2 pid and its child processes (e.g. npm → node → vite)
                        const { stdout: portStr } = await client.exec(
                            `{ pgrep -P ${pid} 2>/dev/null; echo ${pid}; } | xargs -I{} ss -tlnp 2>/dev/null | grep 'pid=' | grep -oP '(?<=:)\\d{4,5}(?=\\s)' | head -1`
                        );
                        const detected = portStr.trim();
                        if (detected && /^\d{4,5}$/.test(detected)) {
                            appPort = detected;
                        }
                    }
                } catch {
                    // Ignore, retry
                }
            }

            // Method 2: Parse PM2 log files directly as fallback
            if (!appPort) {
                try {
                    const { stdout: logContent } = await client.exec(
                        `tail -20 ~/.pm2/logs/${project.name}-out.log 2>/dev/null`
                    );
                    if (logContent) {
                        const portMatches = [...logContent.matchAll(/(?:localhost|0\.0\.0\.0|127\.0\.0\.1):(\d{4,5})/gi)];
                        const fallbackMatches = [...logContent.matchAll(/port\s+(\d{4,5})/gi)];
                        if (portMatches.length > 0) {
                            appPort = portMatches[portMatches.length - 1][1];
                        } else if (fallbackMatches.length > 0) {
                            appPort = fallbackMatches[fallbackMatches.length - 1][1];
                        }
                    }
                } catch {
                    // Ignore
                }
            }

            if (!appPort) {
                appPort = defaultPort;
                log(`Port not detected, using default: ${defaultPort}`);
            }

            const appUrl = `http://${options.server.host}:${appPort}`;
            log(`\n\x1b[36m🌐 Application URL: ${appUrl}\x1b[0m`);
            finalUrl = appUrl;
        }

        // ─── Post-deploy: Update Caddy reverse proxy if domains are configured ───
        if (options.domains && options.domains.length > 0) {
            log('\nUpdating Caddy reverse proxy for configured domains...');
            try {
                const appPort = finalUrl
                    ? new URL(finalUrl).port || '3000'
                    : '3000';

                const domainConfigs: DomainConfig[] = options.domains.map(d => ({
                    hostname: d.hostname,
                    upstreamPort: d.upstreamPort || appPort,
                }));

                await configureCaddy(client, {
                    domains: domainConfigs,
                    tlsMode: options.tlsMode || 'production',
                }, onLog);

                // Update finalUrl to the first domain's HTTPS URL
                const protocol = options.tlsMode === 'internal' ? 'https' : 'https';
                finalUrl = `${protocol}://${options.domains[0].hostname}`;
                log(`\x1b[36m🔒 Domain URL: ${finalUrl}\x1b[0m`);
            } catch (err: any) {
                log(`\x1b[33mWarning: Caddy update failed (deploy still succeeded): ${err.message}\x1b[0m`);
            }
        }

        let commitHash = 'unknown';
        try {
            commitHash = (await execOrThrow(client, `cd ${currentPath} && git rev-parse HEAD`, 'Read commit hash')).trim();
        } catch {
            // Ignore for local bundle deployments which lack .git
        }
        const durationMs = Date.now() - startTime;
        log(`Deployment successful in ${durationMs}ms`);

        return {
            success: true,
            releaseId,
            commitHash,
            durationMs,
            url: finalUrl || `http://${options.server.host}:3000`
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
