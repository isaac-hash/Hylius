import { Command } from 'commander';
import inquirer from 'inquirer';
import dotenv from 'dotenv';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { deploy as coreDeploy, DeployOptions, ServerConfig, ProjectConfig } from '@hylius/core';
import { detectProjectType } from '../utils/detect.js';

dotenv.config();

async function getConfiguration(): Promise<{ server: ServerConfig, project: ProjectConfig }> {
    // 1. Try process.env (CI/CD)
    const envConfig = {
        host: process.env.HYLIUS_HOST,
        username: process.env.HYLIUS_USER,
        port: process.env.HYLIUS_PORT ? parseInt(process.env.HYLIUS_PORT) : 22,
        privateKeyPath: process.env.HYLIUS_SSH_KEY_PATH,
        privateKey: process.env.HYLIUS_SSH_KEY,
        password: process.env.HYLIUS_PASSWORD, // Note: Core types might need password support if not key-based
        targetPath: process.env.HYLIUS_TARGET_PATH,
        repoUrl: process.env.HYLIUS_REPO_URL, // New requirement for Core
        branch: process.env.HYLIUS_BRANCH,
    };

    // Interactive Prompts
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
        },
        {
            type: 'input',
            name: 'targetPath',
            message: 'Target Path on VPS (e.g. /var/www/myapp):',
            default: envConfig.targetPath || '/var/www/hylius-app',
        },
        {
            type: 'input',
            name: 'repoUrl',
            message: 'Git Repository URL:',
            default: envConfig.repoUrl,
            validate: (input) => !!input || 'Repo URL is required for atomic deploys'
        },
        {
            type: 'list',
            name: 'authType',
            message: 'Authentication Method:',
            choices: ['SSH Agent (Recommended)', 'Private Key File', 'Password'] // Password support depends on Core
        },
        {
            type: 'input',
            name: 'privateKeyPath',
            message: 'Path to Private Key:',
            when: (answers) => answers.authType === 'Private Key File',
            default: process.env.HOME + '/.ssh/id_rsa'
        }
    ]);

    // Construct ServerConfig
    const server: ServerConfig = {
        host: answers.host,
        username: answers.username,
        port: envConfig.port,
        privateKeyPath: answers.privateKeyPath || envConfig.privateKeyPath,
        privateKey: envConfig.privateKey,
    };

    // Construct ProjectConfig
    const project: ProjectConfig = {
        name: path.basename(process.cwd()),
        repoUrl: answers.repoUrl,
        branch: envConfig.branch || 'main',
        deployPath: answers.targetPath,
        // Detect build command? For now default or prompt could be added.
        buildCommand: 'npm run build',
        startCommand: 'pm2 reload ecosystem.config.js || pm2 start ecosystem.config.js'
    };

    return { server, project };
}

export async function deploy(options: any) {
    try {
        const { server, project } = await getConfiguration();

        const spinner = ora('Starting deployment...').start();

        const deployOptions: DeployOptions = {
            server,
            project,
            trigger: 'cli',
            onLog: (chunk) => {
                // Stop spinner to log, then restart or just log raw?
                // For CLI experience, maybe just log raw lines if verbose, 
                // but for now let's just log to console above spinner or update spinner text
                spinner.text = chunk.trim().substring(0, 80); // Update spinner with latest log
            }
        };

        const result = await coreDeploy(deployOptions);

        if (result.success) {
            spinner.succeed(chalk.green(`Deployment Successful! Release ID: ${result.releaseId}`));
            console.log(chalk.dim(`Duration: ${result.durationMs}ms`));
            console.log(chalk.dim(`Commit: ${result.commitHash}`));
        } else {
            spinner.fail(chalk.red(`Deployment Failed: ${result.error}`));
            process.exit(1);
        }

    } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
    }
}

export const deployCommand = new Command('deploy')
    .description('Deploy your application using Hylius Core Atomic Deployment')
    .action(deploy);
