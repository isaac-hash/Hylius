import { ServerConfig, DomainConfig, DomainResult, ConfigureCaddyOptions } from './types.js';
import { SSHClient } from './ssh/client.js';
import { resolve } from 'dns/promises';

// ─── Constants ──────────────────────────────────────────────
const CADDY_CONTAINER = 'hylius-caddy';
const CADDY_IMAGE = 'caddy:2-alpine';
const CADDY_HOST_DIR = '/opt/hylius/caddy';
const CADDYFILE_PATH = `${CADDY_HOST_DIR}/Caddyfile`;

// Known web server services that commonly ship with VPS control panels
// and occupy ports 80/443, preventing Caddy from binding.
const CONFLICTING_SERVICES = [
    'apache2',       // Ubuntu/Debian Apache
    'nginx',         // Nginx
    'httpd',         // CentOS/RHEL Apache
    'sw-cp-server',  // Plesk control panel
    'lighttpd',      // Lighttpd
];

// ─── DNS Verification ───────────────────────────────────────

/**
 * Verify that a hostname's DNS A record points to the expected server IP.
 * Returns true if at least one A record matches.
 */
export async function verifyDns(hostname: string, expectedIp: string): Promise<{ verified: boolean; resolvedIps: string[]; error?: string }> {
    try {
        const addresses = await resolve(hostname, 'A');
        const verified = addresses.includes(expectedIp);
        return { verified, resolvedIps: addresses };
    } catch (err: any) {
        if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
            return { verified: false, resolvedIps: [], error: `No DNS A record found for ${hostname}` };
        }
        return { verified: false, resolvedIps: [], error: `DNS lookup failed: ${err.message}` };
    }
}

// ─── Caddyfile Generation ───────────────────────────────────

/**
 * Generate a Caddyfile string from an array of domain configurations.
 */
export function generateCaddyfile(domains: DomainConfig[], tlsMode: 'production' | 'internal' = 'production'): string {
    if (domains.length === 0) {
        // Empty Caddyfile — Caddy will just idle
        return '# Hylius Managed Caddyfile\n# No domains configured yet.\n';
    }

    const blocks = domains.map(d => {
        const tlsDirective = tlsMode === 'internal' ? '\n    tls internal' : '';
        return `${d.hostname} {${tlsDirective}\n    reverse_proxy localhost:${d.upstreamPort}\n}`;
    });

    return `# Hylius Managed Caddyfile — DO NOT EDIT MANUALLY\n# Last updated: ${new Date().toISOString()}\n\n${blocks.join('\n\n')}\n`;
}

// ─── Port Conflict Resolution ───────────────────────────────

/**
 * Stop and disable known web servers (Apache, Nginx, Plesk, etc.) that may be
 * occupying ports 80/443, preventing Caddy from binding.
 * This is idempotent — safe to call even if nothing is blocking.
 */
export async function freeWebPorts(
    client: SSHClient,
    onLog?: (chunk: string) => void
): Promise<void> {
    const log = (msg: string) => { if (onLog) onLog(msg + '\n'); };

    // Quick check: is anything listening on port 80?
    const { stdout: port80Info } = await client.exec(
        `ss -tln 2>/dev/null | grep ':80 ' || echo "FREE"`
    );

    if (port80Info.trim() === 'FREE') {
        return; // Port 80 is available, nothing to do
    }

    log('Detected services blocking ports 80/443 — clearing for Caddy...');

    // Stop and disable common web servers so they don't restart after reboot
    for (const svc of CONFLICTING_SERVICES) {
        await client.exec(`systemctl stop ${svc} 2>/dev/null || true`);
        await client.exec(`systemctl disable ${svc} 2>/dev/null || true`);
    }

    // Force-kill anything still occupying ports 80/443
    await client.exec('fuser -k 80/tcp 2>/dev/null || true');
    await client.exec('fuser -k 443/tcp 2>/dev/null || true');

    // Brief pause for port release
    await new Promise(r => setTimeout(r, 1000));
    log('Conflicting services stopped — ports 80/443 are now available.');
}

// ─── Caddy Container Management ─────────────────────────────

/**
 * Ensure the Caddy Docker container is running on the remote server.
 * If it doesn't exist, pull the image and start it.
 */
export async function ensureCaddyRunning(
    client: SSHClient,
    onLog?: (chunk: string) => void
): Promise<void> {
    const log = (msg: string) => { if (onLog) onLog(msg + '\n'); };

    // Check if container exists and is running
    const { stdout: status } = await client.exec(
        `docker inspect -f '{{.State.Running}}' ${CADDY_CONTAINER} 2>/dev/null || echo "not_found"`
    );

    if (status.trim() === 'true') {
        // Verify Caddy isn't stuck in a bind-error loop
        // (happens when another web server like Apache/Nginx/Plesk occupies port 80)
        const { stdout: bindCheck } = await client.exec(
            `docker logs --tail 30 ${CADDY_CONTAINER} 2>&1 | grep -ci 'address already in use' || echo "0"`
        );

        if (parseInt(bindCheck.trim(), 10) === 0) {
            log(`Caddy container is already running.`);
            return;
        }

        // Caddy running but can't bind — remove it so we can fix conflicts and restart
        log('Caddy is running but cannot bind to ports 80/443 (blocked by another web server).');
        await client.exec(`docker rm -f ${CADDY_CONTAINER} > /dev/null 2>&1 || true`);
        // Fall through to the restart flow below
    }

    // Ensure host directories exist
    await client.exec(`mkdir -p ${CADDY_HOST_DIR}/data ${CADDY_HOST_DIR}/config`);

    // Write default Caddyfile if it doesn't exist
    const { code: caddyfileExists } = await client.exec(`test -f ${CADDYFILE_PATH}`);
    if (caddyfileExists !== 0) {
        const defaultCaddyfile = '# Hylius Managed Caddyfile\\n# No domains configured yet.\\n';
        await client.exec(`echo -e "${defaultCaddyfile}" > ${CADDYFILE_PATH}`);
        log('Created default Caddyfile.');
    }

    // Remove stopped/dead container if it exists
    if (status.trim() !== 'not_found' && status.trim() !== 'true') {
        await client.exec(`docker rm -f ${CADDY_CONTAINER} > /dev/null 2>&1 || true`);
    }

    // Free ports 80/443 from any competing web servers before starting Caddy
    await freeWebPorts(client, onLog);

    // Pull and start Caddy
    log('Pulling Caddy image...');
    const pullCode = await client.execStream(`docker pull ${CADDY_IMAGE}`, onLog, onLog);
    if (pullCode !== 0) {
        throw new Error('Failed to pull Caddy Docker image.');
    }

    log('Starting Caddy container...');
    const runCmd = [
        'docker run -d',
        `--name ${CADDY_CONTAINER}`,
        '--restart unless-stopped',
        '--network host',
        `-v ${CADDYFILE_PATH}:/etc/caddy/Caddyfile`,
        `-v ${CADDY_HOST_DIR}/data:/data`,
        `-v ${CADDY_HOST_DIR}/config:/config`,
        CADDY_IMAGE,
    ].join(' ');

    const { stdout: containerId, code } = await client.exec(runCmd);
    if (code !== 0) {
        throw new Error(`Failed to start Caddy container: ${containerId}`);
    }

    log(`Caddy container started: ${containerId.trim().substring(0, 12)}`);

    // Post-start verification: confirm Caddy actually bound to port 80
    await new Promise(r => setTimeout(r, 2000));
    const { stdout: postBindCheck } = await client.exec(
        `docker logs --tail 10 ${CADDY_CONTAINER} 2>&1 | grep -ci 'address already in use' || echo "0"`
    );
    if (parseInt(postBindCheck.trim(), 10) > 0) {
        log('⚠️  Warning: Caddy started but may still have port binding issues. Check for residual web server processes on the VPS.');
    }
}

// ─── Configure Domains ──────────────────────────────────────

/**
 * Write/update the Caddyfile on the remote server and reload Caddy.
 * This replaces the entire Caddyfile with the provided domain set.
 */
export async function configureCaddy(
    client: SSHClient,
    options: ConfigureCaddyOptions,
    onLog?: (chunk: string) => void
): Promise<void> {
    const log = (msg: string) => { if (onLog) onLog(msg + '\n'); };
    const tlsMode = options.tlsMode || 'production';

    // Ensure Caddy is running first
    await ensureCaddyRunning(client, onLog);

    // Generate the new Caddyfile
    const caddyfileContent = generateCaddyfile(options.domains, tlsMode);

    // Write it to the host (escape for shell)
    const escaped = caddyfileContent.replace(/'/g, "'\\''");
    await client.exec(`cat > ${CADDYFILE_PATH} << 'HYLIUS_EOF'\n${caddyfileContent}HYLIUS_EOF`);

    log(`Caddyfile updated with ${options.domains.length} domain(s).`);

    // Reload Caddy config (graceful reload, no downtime)
    const { code: reloadCode, stderr } = await client.exec(
        `docker exec ${CADDY_CONTAINER} caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile`
    );

    if (reloadCode !== 0) {
        throw new Error(`Caddy reload failed: ${stderr}`);
    }

    log('Caddy reloaded successfully.');
}

// ─── Remove Domain ──────────────────────────────────────────

/**
 * Remove a specific domain from the Caddyfile.
 * Reads the current Caddyfile, filters out the domain block, and rewrites it.
 */
export async function removeDomainFromCaddy(
    client: SSHClient,
    hostname: string,
    remainingDomains: DomainConfig[],
    tlsMode: 'production' | 'internal' = 'production',
    onLog?: (chunk: string) => void
): Promise<void> {
    const log = (msg: string) => { if (onLog) onLog(msg + '\n'); };

    log(`Removing domain ${hostname} from Caddy...`);

    // Rewrite the Caddyfile with the remaining domains (excluding the removed one)
    await configureCaddy(client, { domains: remainingDomains, tlsMode }, onLog);

    log(`Domain ${hostname} removed.`);
}

// ─── High-Level Domain Setup ────────────────────────────────

/**
 * Full domain configuration flow:
 * 1. Verify DNS
 * 2. Ensure Caddy is running
 * 3. Update Caddyfile
 * 4. Reload Caddy
 */
export async function setupDomain(
    server: ServerConfig,
    allDomains: DomainConfig[],
    newHostname: string,
    expectedIp: string,
    options?: { skipDns?: boolean; tlsMode?: 'production' | 'internal'; onLog?: (chunk: string) => void }
): Promise<DomainResult> {
    const log = (msg: string) => { if (options?.onLog) options.onLog(msg + '\n'); };
    const tlsMode = options?.tlsMode || 'production';
    const client = new SSHClient(server);

    try {
        // Step 1: DNS verification (unless skipped for testing)
        if (!options?.skipDns) {
            log(`Verifying DNS for ${newHostname}...`);
            const dnsResult = await verifyDns(newHostname, expectedIp);

            if (!dnsResult.verified) {
                const resolvedStr = dnsResult.resolvedIps.length > 0
                    ? `Resolved to: ${dnsResult.resolvedIps.join(', ')}`
                    : 'No A records found';
                return {
                    success: false,
                    hostname: newHostname,
                    sslProvisioned: false,
                    error: `DNS verification failed. ${resolvedStr}. Expected: ${expectedIp}. Please add an A record pointing ${newHostname} to ${expectedIp}.`,
                };
            }
            log(`DNS verified: ${newHostname} → ${expectedIp}`);
        } else {
            log(`Skipping DNS verification (test mode).`);
        }

        // Step 2-4: SSH in, configure Caddy
        log(`Connecting to ${server.host}...`);
        await client.connect();

        await configureCaddy(client, { domains: allDomains, tlsMode }, options?.onLog);

        const sslProvisioned = tlsMode === 'production';
        log(`Domain ${newHostname} configured.${sslProvisioned ? ' SSL will be provisioned by Caddy automatically.' : ' Using internal TLS (self-signed).'}`);

        return {
            success: true,
            hostname: newHostname,
            sslProvisioned,
        };

    } catch (err: any) {
        log(`Domain setup failed: ${err.message}`);
        return {
            success: false,
            hostname: newHostname,
            sslProvisioned: false,
            error: err.message,
        };
    } finally {
        client.end();
    }
}
