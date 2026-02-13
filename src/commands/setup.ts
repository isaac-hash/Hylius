import { Command } from 'commander';
import { NodeSSH } from 'node-ssh';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import dotenv from 'dotenv';

dotenv.config();

const ssh = new NodeSSH();

export const setupCommand = new Command('setup')
    .description('Provision a fresh VPS with Docker and essential security')
    .action(async () => {
        console.log(chalk.blue.bold('\n🛠️  Hylius Server Provisioning\n'));

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

        const spinner = ora('Connecting to server...').start();

        try {
            await ssh.connect({
                host: answers.host,
                username: answers.username,
                port: answers.port,
                password: answers.password,
                privateKeyPath: answers.privateKeyPath?.replace('~', process.env.HOME || ''),
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
                (answers.password ? `echo '${answers.password}' | sudo -S ` : 'sudo ');

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
                    `${sudoPrefix}apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin`
                ];
            } else if (isAlpine) {
                dockerCommands = [
                    `${sudoPrefix}apk update`,
                    `${sudoPrefix}apk add --no-cache docker docker-cli-compose`,
                    `${sudoPrefix}rc-update add docker default || true`,
                    `${sudoPrefix}addgroup ${currentUser} docker || true`
                ];
            }

            for (const cmd of dockerCommands) {
                spinner.text = `Executing: ${cmd.replace(answers.password || '', '***')}`;
                const res = await ssh.execCommand(cmd);
                if (res.code !== 0) {
                    console.log(chalk.dim(`   Note: command returned ${res.code}`));
                }
            }
            spinner.succeed('Docker installed successfully');

            // 3. Setup Firewall (Optional)
            const { setupUfw } = await inquirer.prompt([{
                type: 'confirm',
                name: 'setupUfw',
                message: 'Setup basic firewall (UFW) and allow SSH/HTTP/HTTPS?',
                default: true
            }]);

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
