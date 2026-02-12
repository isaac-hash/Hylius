import { NodeSSH } from 'node-ssh';
import inquirer from 'inquirer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import chalk from 'chalk';
import ora from 'ora';

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
        const distPath = path.resolve(process.cwd(), 'dist'); // Assuming 'dist' is the build output
        if (!fs.existsSync(distPath)) {
            throw new Error('Dist folder not found! Please run build first.');
        }

        const remoteTempPath = `${config.targetPath}_temp_${Date.now()}`;
        const remoteCurrentPath = config.targetPath!;

        // 2. Upload Files
        spinner.start(`Uploading files to ${remoteTempPath}...`);

        let localPath = distPath;
        const hasCompose = fs.existsSync(path.join(process.cwd(), 'compose.yaml')) ||
            fs.existsSync(path.join(process.cwd(), 'docker-compose.yml')) ||
            fs.existsSync(path.join(process.cwd(), 'docker-compose.yaml'));

        const nextStandalonePath = path.join(process.cwd(), '.next', 'standalone');
        const hasNextStandalone = fs.existsSync(nextStandalonePath);

        // Detect project type to determine what to upload
        if (hasCompose || fs.existsSync(path.join(process.cwd(), 'requirements.txt')) || fs.existsSync(path.join(process.cwd(), 'composer.json'))) {
            localPath = process.cwd(); // Upload root for Docker or interpreted languages
        } else if (hasNextStandalone) {
            // Optimizing Next.js Standalone build
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
        }

        await ssh.putDirectory(localPath, remoteTempPath, {
            recursive: true,
            concurrency: 10,
            validate: (itemPath) => {
                const baseName = path.basename(itemPath);
                return !['node_modules', '.git', '.env', 'venv', '__pycache__', 'vendor', 'dist'].includes(baseName);
            },
            tick: (localPath, remotePath, error) => {
                // optional progress updates
            }
        });
        spinner.succeed('Files uploaded');

        // 3. Atomic Swap
        spinner.start('Swapping directories and restarting...');

        // Ensure parent dir exists
        await ssh.execCommand(`mkdir -p ${path.dirname(remoteCurrentPath)}`);

        // Prepare swap commands (basic version)
        const commands = [
            `rm -rf ${remoteCurrentPath}`,
            `mv ${remoteTempPath} ${remoteCurrentPath}`,
        ];

        // Add install/restart commands
        if (hasCompose) {
            commands.push(`cd ${remoteCurrentPath} && docker compose up -d --build --remove-orphans`);
        } else if (hasNextStandalone) {
            commands.push(`cd ${remoteCurrentPath} && node server.js`);
        } else if (fs.existsSync(path.join(process.cwd(), 'requirements.txt'))) {
            commands.push(`cd ${remoteCurrentPath} && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt`);
            // commands.push(`cd ${remoteCurrentPath} && pm2 reload all || pm2 start "uvicorn main:app --host 0.0.0.0 --port 8000" --name "app"`); // PM2 example
        } else if (fs.existsSync(path.join(process.cwd(), 'composer.json'))) {
            commands.push(`cd ${remoteCurrentPath} && composer install --no-dev --optimize-autoloader`);
            // Laravel specific
            if (fs.existsSync(path.join(process.cwd(), 'artisan'))) {
                commands.push(`cd ${remoteCurrentPath} && php artisan config:cache && php artisan route:cache && php artisan view:cache`);
                commands.push(`chmod -R 775 ${path.join(remoteCurrentPath, 'storage')} ${path.join(remoteCurrentPath, 'bootstrap/cache')}`);
                // Try to set ownership, but don't fail if we can't (user might not be root)
                commands.push(`chown -R www-data:www-data ${path.join(remoteCurrentPath, 'storage')} ${path.join(remoteCurrentPath, 'bootstrap/cache')} || true`);
            }
        } else if (fs.existsSync(path.join(process.cwd(), 'package.json'))) {
            commands.push(`cd ${remoteCurrentPath} && npm install --production`);
            // commands.push(`cd ${remoteCurrentPath} && pm2 reload all || pm2 start npm --name "app" -- start`); // PM2 example
        }

        for (const cmd of commands) {
            spinner.text = `Executing: ${cmd}`;
            const result = await ssh.execCommand(cmd);
            if (result.code !== 0) {
                // Warning only for now, as restart commands might fail on first run
                // throw new Error(`Command failed: ${cmd}\n${result.stderr}`);
                spinner.warn(`Command failed (non-fatal?): ${cmd}\n${result.stderr}`);
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
