import { SetupOptions, SetupResult } from './types.js';
import { SSHClient } from './ssh/client.js';

export async function setup(options: SetupOptions): Promise<SetupResult> {
    const { server, onLog } = options;
    const client = new SSHClient(server);
    const startTime = Date.now();

    const log = (msg: string) => {
        if (onLog) onLog(msg + '\n');
    };

    try {
        log(`\x1b[36mConnecting to ${server.host}...\x1b[0m`);
        await client.connect();
        log('\x1b[32mConnected successfully.\x1b[0m\n');

        // 1. Detect OS and User
        log('\x1b[33m[1/3] Detecting Operating System and User...\x1b[0m');
        const osResult = await client.exec('cat /etc/os-release');
        const userResult = await client.exec('whoami');

        const currentUser = userResult.stdout.trim();
        const isRoot = currentUser === 'root';

        const isUbuntu = osResult.stdout.includes('Ubuntu');
        const isDebian = osResult.stdout.includes('Debian');
        const isAlpine = osResult.stdout.includes('Alpine');

        if (isUbuntu || isDebian) {
            log(`Detected OS: \x1b[36m${isUbuntu ? 'Ubuntu' : 'Debian'}\x1b[0m (User: ${currentUser})\n`);
        } else if (isAlpine) {
            log(`Detected OS: \x1b[36mAlpine Linux\x1b[0m (User: ${currentUser})\n`);
        } else {
            log(`Detected OS: \x1b[33mUnknown/Unsupported\x1b[0m (User: ${currentUser})\n`);
            throw new Error('Unsupported Linux distribution. Hylius requires Ubuntu, Debian, or Alpine.');
        }

        // Build sudo prefix
        const sudoPrefix = isRoot ? '' : 'sudo ';

        // 2. Install Docker
        log('\x1b[33m[2/3] Installing Docker and dependencies...\x1b[0m');
        let dockerCommands: string[] = [];

        if (isUbuntu || isDebian) {
            dockerCommands = [
                `${sudoPrefix}apt-get update`,
                `${sudoPrefix}apt-get install -y ca-certificates curl gnupg lsb-release`,
                `${sudoPrefix}mkdir -p /etc/apt/keyrings`,
                `curl -fsSL https://download.docker.com/linux/ubuntu/gpg | ${sudoPrefix}gpg --dearmor -o /etc/apt/keyrings/docker.gpg || true`,
                `echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$(. /etc/os-release && echo "$ID") $(lsb_release -cs) stable" | ${sudoPrefix}tee /etc/apt/sources.list.d/docker.list > /dev/null`,
                `${sudoPrefix}apt-get update`,
                `${sudoPrefix}apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin git`,
                // Install Node.js 20 LTS via NodeSource (distro nodejs is v12, too old for Vite/ESM)
                `curl -fsSL https://deb.nodesource.com/setup_20.x | ${sudoPrefix}bash -`,
                `${sudoPrefix}apt-get install -y nodejs`,
                `${sudoPrefix}npm install -g pm2`
            ];
        } else if (isAlpine) {
            dockerCommands = [
                `${sudoPrefix}apk update`,
                `${sudoPrefix}apk add --no-cache docker docker-cli-compose git nodejs npm`,
                `${sudoPrefix}npm install -g pm2`,
                `${sudoPrefix}rc-update add docker default || true`,
                `${sudoPrefix}addgroup ${currentUser} docker || true`
            ];
        }

        for (const cmd of dockerCommands) {
            log(`> Executing: ${cmd}`);
            await client.execStream(cmd, onLog, onLog);
        }
        log('\x1b[32mDocker and Git installed successfully.\x1b[0m\n');

        // 3. Install & Start Caddy reverse proxy
        log('\x1b[33m[3/4] Setting up Caddy reverse proxy for domain management...\x1b[0m');
        const caddyCommands = [
            // Create host directories for Caddy data
            `${sudoPrefix}mkdir -p /opt/hylius/caddy/data /opt/hylius/caddy/config`,
            // Write default Caddyfile if it doesn't exist
            `test -f /opt/hylius/caddy/Caddyfile || echo '# Hylius Managed Caddyfile' | ${sudoPrefix}tee /opt/hylius/caddy/Caddyfile > /dev/null`,
            // Pull Caddy image
            `${sudoPrefix}docker pull caddy:2-alpine`,
            // Remove any existing Caddy container (idempotent re-provisioning)
            `${sudoPrefix}docker rm -f hylius-caddy > /dev/null 2>&1 || true`,
            // Start Caddy with host networking so it can proxy to localhost:PORT
            `${sudoPrefix}docker run -d --name hylius-caddy --restart unless-stopped --network host -v /opt/hylius/caddy/Caddyfile:/etc/caddy/Caddyfile -v /opt/hylius/caddy/data:/data -v /opt/hylius/caddy/config:/config caddy:2-alpine`,
        ];

        for (const cmd of caddyCommands) {
            log(`> Executing: ${cmd}`);
            await client.execStream(cmd, onLog, onLog);
        }
        log('\x1b[32mCaddy reverse proxy installed and running.\x1b[0m\n');

        // 4. Setup UFW / Firewall
        log('\x1b[33m[4/4] Configuring basic firewall (UFW)...\x1b[0m');
        // We attempt UFW setup, but ignore failures (e.g., if running inside a Docker mock container without ufw)
        const ufwCommands = [
            `${sudoPrefix}apt-get install -y ufw > /dev/null 2>&1 || ${sudoPrefix}apk add --no-cache ufw > /dev/null 2>&1 || true`,
            `${sudoPrefix}ufw allow 22/tcp > /dev/null 2>&1 || true`,
            `${sudoPrefix}ufw allow 80/tcp > /dev/null 2>&1 || true`,
            `${sudoPrefix}ufw allow 443/tcp > /dev/null 2>&1 || true`,
            `echo "y" | ${sudoPrefix}ufw enable > /dev/null 2>&1 || true`
        ];

        for (const cmd of ufwCommands) {
            log(`> Executing: ${cmd}`);
            await client.execStream(cmd, onLog, onLog);
        }
        log('\x1b[32mFirewall configured (if supported by OS).\x1b[0m\n');

        const durationMs = Date.now() - startTime;
        log(`\x1b[32m\x1b[1m✅ Server provisioning complete in ${durationMs}ms!\x1b[0m\x1b[0m\n`);

        return {
            success: true,
            durationMs
        };

    } catch (err: any) {
        log(`\x1b[31mSetup failed: ${err.message}\x1b[0m\n`);
        return {
            success: false,
            durationMs: Date.now() - startTime,
            error: err.message
        };
    } finally {
        client.end();
    }
}
