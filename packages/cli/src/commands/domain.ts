import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import dotenv from 'dotenv';
import { NodeSSH } from 'node-ssh';
import { loadConfig } from '../utils/config.js';

dotenv.config();

// Determine if we're running in CI/CD (headless) mode
function isCI(): boolean {
    return !!(process.env.CI || process.env.GITHUB_ACTIONS);
}

async function getServerConfig() {
    const host = process.env.HYLIUS_HOST;
    const username = process.env.HYLIUS_USER || 'root';
    const port = parseInt(process.env.HYLIUS_PORT || '22');
    const password = process.env.HYLIUS_PASSWORD;
    const privateKey = process.env.HYLIUS_SSH_KEY;
    const privateKeyPath = process.env.HYLIUS_SSH_KEY_PATH;

    if (!host) {
        if (isCI()) {
            throw new Error('HYLIUS_HOST environment variable is required.');
        }
        // Interactive mode
        const answers = await inquirer.prompt([
            { type: 'input', name: 'host', message: 'VPS Host IP:' },
            { type: 'input', name: 'username', message: 'VPS Username:', default: 'root' },
            { type: 'number', name: 'port', message: 'SSH Port:', default: 22 },
            {
                type: 'list', name: 'authMethod', message: 'Authentication Method:',
                choices: ['Password', 'SSH Key'],
            },
            { type: 'password', name: 'password', message: 'VPS Password:', when: (a) => a.authMethod === 'Password' },
            { type: 'input', name: 'privateKeyPath', message: 'Path to Private Key:', default: '~/.ssh/id_rsa', when: (a) => a.authMethod === 'SSH Key' },
        ]);
        return answers;
    }

    return { host, username, port, password, privateKey, privateKeyPath };
}

async function connectSSH(config: unknown): Promise<NodeSSH> {
    const ssh = new NodeSSH();
    await ssh.connect({
        host: config.host,
        username: config.username,
        port: config.port,
        password: config.password,
        privateKey: config.privateKey,
        privateKeyPath: config.privateKeyPath?.replace('~', process.env.HOME || ''),
        tryKeyboard: true,
        agent: process.env.SSH_AUTH_SOCK,
    });
    return ssh;
}

// ─── Domain Command Group ───────────────────────────────────

export const domainCommand = new Command('domain')
    .description('Manage custom domains for your project');

// ─── domain add <hostname> ──────────────────────────────────

domainCommand
    .command('add <hostname>')
    .option('--skip-dns', 'Skip DNS verification (for testing)')
    .option('--port <port>', 'Upstream port', '3000')
    .description('Add a custom domain to the current project')
    .action(async (hostname: string, options: { skipDns?: boolean; port: string }) => {
        const config = loadConfig();
        if (!config) {
            console.log(chalk.red('No hylius.yaml found. Run `hylius init` first.'));
            process.exit(1);
        }

        const spinner = ora(`Adding domain ${chalk.cyan(hostname)}...`).start();

        try {
            const serverConfig = await getServerConfig();
            const ssh = await connectSSH(serverConfig);

            const tlsMode = process.env.HYLIUS_TLS_MODE === 'internal' ? 'internal' : 'production';
            const upstreamPort = options.port;

            // DNS verification (unless skipped)
            if (!options.skipDns) {
                spinner.text = `Verifying DNS for ${hostname}...`;
                const { resolve } = await import('dns/promises');
                try {
                    const addresses = await resolve(hostname, 'A');
                    if (!addresses.includes(serverConfig.host)) {
                        spinner.warn(`DNS not yet pointing to ${serverConfig.host}. Resolved: ${addresses.join(', ') || 'none'}`);
                        console.log(chalk.yellow(`\n  Add an A record for ${hostname} → ${serverConfig.host}`));
                        console.log(chalk.yellow(`  Then run: ${chalk.white.bold(`hylius domain verify ${hostname}`)}\n`));
                        ssh.dispose();
                        return;
                    }
                    spinner.text = `DNS verified: ${hostname} → ${serverConfig.host}`;
                } catch (dnsErr: unknown) {
                    spinner.warn(`DNS lookup failed for ${hostname}: ${dnsErr.message}`);
                    console.log(chalk.yellow(`\n  Add an A record for ${hostname} → ${serverConfig.host}`));
                    console.log(chalk.yellow(`  Then run: ${chalk.white.bold(`hylius domain verify ${hostname}`)}\n`));
                    ssh.dispose();
                    return;
                }
            }

            // Read existing Caddyfile to build domain list
            spinner.text = 'Reading current Caddy configuration...';
            const { stdout: existingCaddyfile } = await ssh.execCommand('cat /opt/hylius/caddy/Caddyfile 2>/dev/null || echo ""');

            // Parse existing domains from Caddyfile (simple regex parse)
            const existingDomains: { hostname: string; upstreamPort: string }[] = [];
            const blockRegex = /^(\S+)\s*\{[^}]*reverse_proxy\s+localhost:(\d+)/gm;
            let match;
            while ((match = blockRegex.exec(existingCaddyfile)) !== null) {
                if (match[1] !== hostname) {
                    existingDomains.push({ hostname: match[1], upstreamPort: match[2] });
                }
            }

            // Add the new domain
            const allDomains = [...existingDomains, { hostname, upstreamPort }];

            // Generate Caddyfile
            const tlsDirective = tlsMode === 'internal' ? '\n    tls internal' : '';
            const blocks = allDomains.map(d =>
                `${d.hostname} {${tlsDirective}\n    reverse_proxy localhost:${d.upstreamPort}\n}`
            );
            const caddyfileContent = `# Hylius Managed Caddyfile\n# Last updated: ${new Date().toISOString()}\n\n${blocks.join('\n\n')}\n`;

            // Write Caddyfile
            spinner.text = 'Updating Caddyfile...';
            await ssh.execCommand(`cat > /opt/hylius/caddy/Caddyfile << 'HYLIUS_EOF'\n${caddyfileContent}HYLIUS_EOF`);

            // Reload Caddy
            spinner.text = 'Reloading Caddy...';
            const reloadResult = await ssh.execCommand(
                'docker exec hylius-caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile'
            );

            if (reloadResult.code !== 0) {
                throw new Error(`Caddy reload failed: ${reloadResult.stderr}`);
            }

            ssh.dispose();

            const protocol = 'https';
            spinner.succeed(`Domain ${chalk.green(hostname)} added!`);
            console.log(chalk.cyan(`\n  🔗 ${protocol}://${hostname}\n`));

            if (tlsMode === 'production') {
                console.log(chalk.dim('  Caddy will automatically provision a Let\'s Encrypt SSL certificate.'));
            } else {
                console.log(chalk.dim('  Using internal TLS (self-signed certificate for testing).'));
            }

        } catch (error: unknown) {
            spinner.fail(chalk.red(`Failed to add domain: ${error.message}`));
            process.exit(1);
        }
    });

// ─── domain list ────────────────────────────────────────────

domainCommand
    .command('list')
    .description('List configured domains for the current project')
    .action(async () => {
        const spinner = ora('Reading domain configuration...').start();

        try {
            const serverConfig = await getServerConfig();
            const ssh = await connectSSH(serverConfig);

            const { stdout: caddyfile } = await ssh.execCommand('cat /opt/hylius/caddy/Caddyfile 2>/dev/null || echo ""');
            ssh.dispose();

            // Parse domains
            const domains: { hostname: string; port: string }[] = [];
            const blockRegex = /^(\S+)\s*\{[^}]*reverse_proxy\s+localhost:(\d+)/gm;
            let match;
            while ((match = blockRegex.exec(caddyfile)) !== null) {
                domains.push({ hostname: match[1], port: match[2] });
            }

            spinner.stop();

            if (domains.length === 0) {
                console.log(chalk.yellow('\n  No domains configured. Add one with: hylius domain add myapp.com\n'));
            } else {
                console.log(chalk.blue.bold(`\n  Configured Domains (${domains.length}):\n`));
                for (const d of domains) {
                    console.log(`  ${chalk.green('●')} ${chalk.cyan(d.hostname)} → localhost:${d.port}`);
                }
                console.log('');
            }
        } catch (error: any) {
            spinner.fail(chalk.red(`Failed to list domains: ${error.message}`));
            process.exit(1);
        }
    });

// ─── domain remove <hostname> ───────────────────────────────

domainCommand
    .command('remove <hostname>')
    .description('Remove a domain from the current project')
    .action(async (hostname: string) => {
        const spinner = ora(`Removing domain ${chalk.cyan(hostname)}...`).start();

        try {
            const serverConfig = await getServerConfig();
            const ssh = await connectSSH(serverConfig);

            // Read existing Caddyfile
            const { stdout: caddyfile } = await ssh.execCommand('cat /opt/hylius/caddy/Caddyfile 2>/dev/null || echo ""');

            // Parse and filter out the removed domain
            const remainingDomains: { hostname: string; upstreamPort: string }[] = [];
            const blockRegex = /^(\S+)\s*\{[^}]*reverse_proxy\s+localhost:(\d+)/gm;
            let match;
            let found = false;
            while ((match = blockRegex.exec(caddyfile)) !== null) {
                if (match[1] === hostname) {
                    found = true;
                } else {
                    remainingDomains.push({ hostname: match[1], upstreamPort: match[2] });
                }
            }

            if (!found) {
                spinner.warn(`Domain ${hostname} not found in Caddy configuration.`);
                ssh.dispose();
                return;
            }

            // Rewrite Caddyfile
            const tlsMode = process.env.HYLIUS_TLS_MODE === 'internal' ? 'internal' : 'production';
            const tlsDirective = tlsMode === 'internal' ? '\n    tls internal' : '';

            let caddyfileContent: string;
            if (remainingDomains.length === 0) {
                caddyfileContent = '# Hylius Managed Caddyfile\n# No domains configured yet.\n';
            } else {
                const blocks = remainingDomains.map(d =>
                    `${d.hostname} {${tlsDirective}\n    reverse_proxy localhost:${d.upstreamPort}\n}`
                );
                caddyfileContent = `# Hylius Managed Caddyfile\n# Last updated: ${new Date().toISOString()}\n\n${blocks.join('\n\n')}\n`;
            }

            await ssh.execCommand(`cat > /opt/hylius/caddy/Caddyfile << 'HYLIUS_EOF'\n${caddyfileContent}HYLIUS_EOF`);

            // Reload Caddy
            const reloadResult = await ssh.execCommand(
                'docker exec hylius-caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile'
            );

            if (reloadResult.code !== 0) {
                throw new Error(`Caddy reload failed: ${reloadResult.stderr}`);
            }

            ssh.dispose();
            spinner.succeed(`Domain ${chalk.red(hostname)} removed.`);
        } catch (error: any) {
            spinner.fail(chalk.red(`Failed to remove domain: ${error.message}`));
            process.exit(1);
        }
    });

// ─── domain verify <hostname> ───────────────────────────────

domainCommand
    .command('verify <hostname>')
    .description('Re-check DNS for a domain and activate it')
    .action(async (hostname: string) => {
        const spinner = ora(`Verifying DNS for ${chalk.cyan(hostname)}...`).start();

        try {
            const serverConfig = await getServerConfig();
            const { resolve } = await import('dns/promises');

            const addresses = await resolve(hostname, 'A');
            if (!addresses.includes(serverConfig.host)) {
                spinner.fail(`DNS for ${hostname} does not point to ${serverConfig.host}`);
                console.log(chalk.yellow(`  Resolved to: ${addresses.join(', ') || 'none'}`));
                console.log(chalk.yellow(`  Expected:    ${serverConfig.host}`));
                console.log(chalk.yellow(`\n  Update your DNS A record and try again.\n`));
                return;
            }

            spinner.succeed(`DNS verified: ${chalk.green(hostname)} → ${serverConfig.host}`);
            console.log(chalk.cyan(`\n  Domain is ready! Caddy will handle SSL automatically.\n`));

        } catch (error: any) {
            spinner.fail(chalk.red(`DNS verification failed: ${error.message}`));
            if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
                console.log(chalk.yellow(`  No A record found for ${hostname}. Please configure your DNS.`));
            }
            process.exit(1);
        }
    });
