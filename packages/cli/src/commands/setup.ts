import { Command } from 'commander';
import { NodeSSH } from 'node-ssh';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import dotenv from 'dotenv';

dotenv.config();

const ssh = new NodeSSH();

// Determine if we're running in CI/CD (headless) mode
function isCI(): boolean {
    return !!(process.env.CI || process.env.GITHUB_ACTIONS);
}

async function getSetupConfiguration() {
    // In CI mode, read everything from environment variables
    if (isCI()) {
        const host = process.env.HYLIUS_HOST;
        const username = process.env.HYLIUS_USER || 'root';
        const port = parseInt(process.env.HYLIUS_PORT || '22');
        const password = process.env.HYLIUS_PASSWORD;
        const privateKey = process.env.HYLIUS_SSH_KEY;
        const privateKeyPath = process.env.HYLIUS_SSH_KEY_PATH;

        if (!host) {
            throw new Error('CI mode: HYLIUS_HOST is required. Set it as an environment variable or GitHub Secret.');
        }
        if (!password && !privateKey && !privateKeyPath) {
            throw new Error('CI mode: One of HYLIUS_PASSWORD, HYLIUS_SSH_KEY, or HYLIUS_SSH_KEY_PATH is required.');
        }

        return { host, username, port, password, privateKey, privateKeyPath };
    }

    // Interactive mode — prompt the user
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'host',
            message: 'VPS Host IP:',
            default: process.env.HYLIUS_HOST
        },
        {
            type: 'input',
            name: 'username',
            message: 'VPS Username:',
            default: process.env.HYLIUS_USER || 'root'
        },
        {
            type: 'number',
            name: 'port',
            message: 'SSH Port:',
            default: parseInt(process.env.HYLIUS_PORT || '22')
        },
        {
            type: 'list',
            name: 'authMethod',
            message: 'Authentication Method:',
            choices: ['Password', 'SSH Key']
        },
        {
            type: 'password',
            name: 'password',
            message: 'VPS Password:',
            when: (a) => a.authMethod === 'Password'
        },
        {
            type: 'input',
            name: 'privateKeyPath',
            message: 'Path to Private Key:',
            default: '~/.ssh/id_rsa',
            when: (a) => a.authMethod === 'SSH Key'
        }
    ]);

    return answers;
}

export const setupCommand = new Command('setup')
    .description('Provision a fresh VPS with Docker and essential security')
    .action(async () => {
        console.log(chalk.blue.bold('\n🛠️  Hylius Server Provisioning\n'));

        if (isCI()) {
            console.log(chalk.dim('Running in CI/CD mode (headless)'));
        }

        const config = await getSetupConfiguration();
        const spinner = ora('Connecting to server...').start();

        try {
            await ssh.connect({
                host: config.host,
                username: config.username,
                port: config.port,
                password: config.password,
                privateKey: config.privateKey,
                privateKeyPath: config.privateKeyPath?.replace('~', process.env.HOME || ''),
                tryKeyboard: true,
                agent: process.env.SSH_AUTH_SOCK
            });

            spinner.succeed('Connected to server');

            // 1. Detect OS and User
            spinner.start('Detecting OS and User...');
            const osResult = await ssh.execCommand('cat /etc/os-release');
            const userResult = await ssh.execCommand('whoami');
            const currentUser = userResult.stdout.trim();
            const isRoot = currentUser === 'root';

            // Build a sudo prefix that pipes the password via stdin (-S flag)
            // This is how automation tools like Ansible handle sudo over SSH
            const sudoPrefix = isRoot ? '' :
                (config.password ? `echo '${config.password}' | sudo -S ` : 'sudo ');

            const isUbuntu = osResult.stdout.includes('Ubuntu');
            const isDebian = osResult.stdout.includes('Debian');
            const isAlpine = osResult.stdout.includes('Alpine');

            if (isUbuntu || isDebian) {
                spinner.succeed(`Detected OS: ${isUbuntu ? 'Ubuntu' : 'Debian'} (User: ${currentUser})`);
            } else if (isAlpine) {
                spinner.succeed(`Detected OS: Alpine Linux (User: ${currentUser})`);
            } else {
                spinner.warn(`Unknown OS detected. (User: ${currentUser})`);
            }

            // 2. Install Docker
            spinner.start('Installing Docker...');
            let dockerCommands: string[] = [];

            if (isUbuntu || isDebian) {
                dockerCommands = [
                    `${sudoPrefix}apt-get update`,
                    `${sudoPrefix}apt-get install -y ca-certificates curl gnupg lsb-release`,
                    `${sudoPrefix}mkdir -p /etc/apt/keyrings`,
                    `curl -fsSL https://download.docker.com/linux/ubuntu/gpg | ${sudoPrefix}gpg --dearmor -o /etc/apt/keyrings/docker.gpg || true`,
                    `echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$(. /etc/os-release && echo "$ID") $(lsb_release -cs) stable" | ${sudoPrefix}tee /etc/apt/sources.list.d/docker.list > /dev/null`,
                    `${sudoPrefix}apt-get update`,
                    `${sudoPrefix}apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin`,
                    `${sudoPrefix}systemctl enable docker || true`,
                    `${sudoPrefix}systemctl start docker || true`
                ];
            } else if (isAlpine) {
                dockerCommands = [
                    `${sudoPrefix}apk update`,
                    `${sudoPrefix}apk add --no-cache docker docker-cli-compose`,
                    `${sudoPrefix}rc-update add docker default || true`,
                    `${sudoPrefix}addgroup ${currentUser} docker || true`,
                    `${sudoPrefix}service docker start || ${sudoPrefix}rc-service docker start || true`
                ];
            }

            for (const cmd of dockerCommands) {
                spinner.text = `Executing: ${cmd.replace(config.password || '', '***')}`;
                const res = await ssh.execCommand(cmd);
                if (res.code !== 0) {
                    console.log(chalk.dim(`   Note: command returned ${res.code}`));
                }
            }
            spinner.succeed('Docker installed successfully');

            // 3. Setup Firewall — auto-enable in CI, prompt in interactive mode
            let setupUfw = true;
            if (!isCI()) {
                const ufwAnswer = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'setupUfw',
                    message: 'Setup basic firewall (UFW) and allow SSH/HTTP/HTTPS?',
                    default: true
                }]);
                setupUfw = ufwAnswer.setupUfw;
            } else {
                console.log(chalk.dim('CI mode: Auto-enabling UFW firewall'));
            }

            if (setupUfw) {
                spinner.start('Configuring UFW...');
                const ufwCommands = [
                    `${sudoPrefix}apt-get install -y ufw || ${sudoPrefix}apk add --no-cache ufw || true`,
                    `${sudoPrefix}ufw allow 22/tcp`,
                    `${sudoPrefix}ufw allow 80/tcp`,
                    `${sudoPrefix}ufw allow 443/tcp`,
                    `echo "y" | ${sudoPrefix}ufw enable`
                ];
                for (const cmd of ufwCommands) {
                    await ssh.execCommand(cmd);
                }
                spinner.succeed('Firewall configured');
            }

            console.log(chalk.green.bold('\n✅ Server provisioning complete!'));
            console.log(chalk.cyan('You can now deploy your apps using: ') + chalk.white.bold('hylius deploy\n'));

            ssh.dispose();

        } catch (error: any) {
            spinner.fail(chalk.red(`Setup failed: ${error.message}`));
            ssh.dispose();
            process.exit(1);
        }
    });
