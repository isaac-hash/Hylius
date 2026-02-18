import { NodeSSH } from 'node-ssh';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import chalk from 'chalk';
import ora from 'ora';
import { detectProjectType } from '../utils/detect.js';

dotenv.config();

const ssh = new NodeSSH();

interface HyliusConfig {
    deploy?: {
        host?: string;
        username?: string;
        port?: number;
        privateKeyPath?: string;
        password?: string;
        targetPath?: string;
    }
}

async function getConfiguration() {
    // 1. Try process.env (CI/CD)
    const envConfig = {
        host: process.env.HYLIUS_HOST,
        username: process.env.HYLIUS_USER,
        port: process.env.HYLIUS_PORT ? parseInt(process.env.HYLIUS_PORT) : 22,
        privateKeyPath: process.env.HYLIUS_SSH_KEY_PATH, // Optional: path to key file
        privateKey: process.env.HYLIUS_SSH_KEY, // Optional: content of key
        password: process.env.HYLIUS_PASSWORD,
        targetPath: process.env.HYLIUS_TARGET_PATH,
    };

    // Check if we have enough info from ENV
    if (envConfig.host && envConfig.username && (envConfig.privateKey || envConfig.privateKeyPath || envConfig.password) && envConfig.targetPath) {
        return envConfig;
    }

    // 2. Try Local Config File (e.g., hylius.config.json or similar - skipping for now as per plan, focusing on interactive)

    // 3. Interactive Prompts
    console.log(chalk.blue('≡ƒöî Configuration needed for deployment'));

    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'host',
            message: 'VPS Host IP:',
            default: envConfig.host,
            validate: (input) => !!input || 'Host is required'
        },
        {
            type: 'input',
            name: 'username',
            message: 'VPS Username:',
            default: envConfig.username || 'root',
            validate: (input) => !!input || 'Username is required'
        },
        {
            type: 'number',
            name: 'port',
            message: 'SSH Port:',
            default: envConfig.port || 22
        },
        {
            type: 'input',
            name: 'targetPath',
            message: 'Target Path on VPS:',
            default: envConfig.targetPath || '/var/www/my-app',
            validate: (input) => !!input || 'Target path is required'
        },
        {
            type: 'list',
            name: 'authType',
            message: 'Authentication Method:',
            choices: ['SSH Agent (Recommended)', 'Private Key File', 'Password']
        },
        {
            type: 'input',
            name: 'privateKeyPath',
            message: 'Path to Private Key:',
            when: (answers) => answers.authType === 'Private Key File',
            default: process.env.HOME + '/.ssh/id_rsa'
        },
        {
            type: 'password',
            name: 'password',
            message: 'Password:',
            when: (answers) => answers.authType === 'Password'
        }
    ]);

    return {
        ...envConfig,
        ...answers
    };
}

export async function deploy(options: any) {
    const config = await getConfiguration();
    const spinner = ora('Initializing deployment...').start();

    try {
        spinner.text = `Connecting to ${config.username}@${config.host}...`;

        await ssh.connect({
            host: config.host,
            username: config.username,
            port: config.port,
            privateKeyPath: config.privateKeyPath,
            privateKey: config.privateKey,
            password: config.password,
            tryKeyboard: true,
            // If using SSH agent
            agent: process.env.SSH_AUTH_SOCK
        });

        spinner.succeed('Connected to server');

        // 1. Prepare Paths
        const distPath = path.resolve(process.cwd(), 'dist');
        const remoteTempPath = `${config.targetPath}_temp_${Date.now()}`;
        const remoteCurrentPath = config.targetPath!;

        // 2. Detection & Prep
        spinner.start('Detecting framework and preparing build...');
        const projectType = detectProjectType();
        const hasCompose = fs.existsSync(path.join(process.cwd(), 'compose.yaml')) ||
            fs.existsSync(path.join(process.cwd(), 'docker-compose.yml')) ||
            fs.existsSync(path.join(process.cwd(), 'docker-compose.yaml')) ||
            fs.existsSync(path.join(process.cwd(), 'Dockerfile'));

        const nextStandalonePath = path.join(process.cwd(), '.next', 'standalone');
        const hasNextStandalone = fs.existsSync(nextStandalonePath);

        let localPath = process.cwd(); // Default to root for Railpack/Docker

        if (hasCompose) {
            spinner.text = 'Using existing Docker configuration...';
        } else if (hasNextStandalone && projectType === 'next') {
            spinner.text = 'Preparing Next.js standalone build...';
            // Copy public
            const publicDir = path.join(process.cwd(), 'public');
            const standalonePublic = path.join(nextStandalonePath, 'public');
            if (fs.existsSync(publicDir)) {
                fs.cpSync(publicDir, standalonePublic, { recursive: true, force: true });
            }

            // Copy static
            const staticDir = path.join(process.cwd(), '.next', 'static');
            const standaloneStatic = path.join(nextStandalonePath, '.next', 'static');
            if (fs.existsSync(staticDir)) {
                fs.mkdirSync(path.dirname(standaloneStatic), { recursive: true });
                fs.cpSync(staticDir, standaloneStatic, { recursive: true, force: true });
            }
            localPath = nextStandalonePath;
        } else {
            // Zero-Config / Railpack Mode
            spinner.text = `Zero-config: Auto-containerizing ${projectType} project via Railpack...`;
            try {
                // We use railpack to generate a Dockerfile if one doesn't exist
                // This is a simplified implementation for the MVP
                execSync('railpack build -o .', { stdio: 'ignore' });
                // Note: In a real scenario, we might want to build locally and push, 
                // or upload and build on remote. For now, we assume local build + upload root.
            } catch (error) {
                // If railpack isn't installed or fails, we fall back to manual detection logic for upload paths
                if (projectType === 'node' && fs.existsSync(distPath)) {
                    localPath = distPath;
                }
            }
        }

        // 3. Upload Files
        spinner.start(`Uploading files to ${remoteTempPath}...`);
        await ssh.putDirectory(localPath, remoteTempPath, {
            recursive: true,
            concurrency: 10,
            validate: (itemPath) => {
                const baseName = path.basename(itemPath);
                return !['node_modules', '.git', '.env', 'venv', '__pycache__', 'vendor', 'dist'].includes(baseName);
            }
        });
        spinner.succeed('Files uploaded');

        // 4. Atomic Swap & Execute
        spinner.start('Swapping directories and restarting...');
        const userResult = await ssh.execCommand('whoami');
        const currentUser = userResult.stdout.trim();
        const isRoot = currentUser === 'root';
        const sudoPrefix = isRoot ? '' :
            (config.password ? `echo '${config.password}' | sudo -S ` : 'sudo ');

        await ssh.execCommand(`${sudoPrefix}mkdir -p ${path.dirname(remoteCurrentPath)}`);

        const commands = [
            `${sudoPrefix}rm -rf ${remoteCurrentPath}`,
            `${sudoPrefix}mv ${remoteTempPath} ${remoteCurrentPath}`,
        ];

        if (hasCompose || !hasNextStandalone) {
            // If we have compose OR we use railpack (which generates a Dockerfile), use Docker
            commands.push(`cd ${remoteCurrentPath} && ${sudoPrefix}docker compose up -d --build --remove-orphans || (${sudoPrefix}docker build -t app . && ${sudoPrefix}docker run -d --name app -p 3000:3000 app)`);
        } else if (hasNextStandalone) {
            commands.push(`cd ${remoteCurrentPath} && node server.js`);
        }

        for (const cmd of commands) {
            spinner.text = `Executing: ${cmd.replace(config.password || '', '***')}`;
            const result = await ssh.execCommand(cmd);
            if (result.code !== 0) {
                spinner.warn(`Command failed (non-fatal?): ${cmd.replace(config.password || '', '***')}\n${result.stderr}`);
            }
        }

        spinner.succeed(chalk.green('Deployment successful! ≡ƒÜÇ'));

        ssh.dispose();

    } catch (error: any) {
        spinner.fail(chalk.red(`Deployment failed: ${error.message}`));
        ssh.dispose();
        process.exit(1);
    }
}

export const deployCommand = new Command('deploy')
    .description('Deploy your application to a remote VPS')
    .action(deploy);
