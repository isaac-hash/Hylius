import { Command } from 'commander';
import inquirer from 'inquirer';
import dotenv from 'dotenv';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { deploy as coreDeploy, DeployOptions, ServerConfig, ProjectConfig } from '@hylius/core';
import { detectProjectType } from '../utils/detect.js';

dotenv.config();

// Determine if we're running in CI/CD (headless) mode
function isCI(): boolean {
    return !!(process.env.CI || process.env.GITHUB_ACTIONS);
}

async function getConfiguration(): Promise<{ server: ServerConfig; project: ProjectConfig }> {
    // 1. Try process.env (CI/CD)
    const envConfig = {
        host: process.env.HYLIUS_HOST,
        username: process.env.HYLIUS_USER,
        port: process.env.HYLIUS_PORT ? parseInt(process.env.HYLIUS_PORT) : 22,
        privateKeyPath: process.env.HYLIUS_SSH_KEY_PATH,
        privateKey: process.env.HYLIUS_SSH_KEY,
        password: process.env.HYLIUS_PASSWORD,
        targetPath: process.env.HYLIUS_TARGET_PATH,
        repoUrl: process.env.HYLIUS_REPO_URL,
        branch: process.env.HYLIUS_BRANCH,
    };

    if (isCI()) {
        if (!envConfig.host || !envConfig.repoUrl || !envConfig.targetPath) {
            throw new Error('CI mode: HYLIUS_HOST, HYLIUS_REPO_URL, and HYLIUS_TARGET_PATH are required.');
        }
        if (!envConfig.password && !envConfig.privateKey && !envConfig.privateKeyPath) {
            throw new Error('CI mode: One of HYLIUS_PASSWORD, HYLIUS_SSH_KEY, or HYLIUS_SSH_KEY_PATH is required.');
        }

        const server: ServerConfig = {
            host: envConfig.host,
            username: envConfig.username || 'root',
            port: envConfig.port,
            privateKeyPath: envConfig.privateKeyPath,
            privateKey: envConfig.privateKey,
            password: envConfig.password,
        };

        const project: ProjectConfig = {
            name: path.basename(process.cwd()),
            repoUrl: envConfig.repoUrl,
            branch: envConfig.branch || 'main',
            deployPath: envConfig.targetPath,
            buildCommand: process.env.HYLIUS_BUILD_COMMAND || 'npm run build',
            startCommand: process.env.HYLIUS_START_COMMAND || 'pm2 reload ecosystem.config.js || pm2 start ecosystem.config.js'
        };

        return { server, project };
    }

    // Interactive Prompts
    console.log(chalk.blue('🔍 Configuration needed for deployment'));

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
            choices: ['SSH Agent (Recommended)', 'Private Key File', 'Password']
        },
        {
            type: 'input',
            name: 'privateKeyPath',
            message: 'Path to Private Key:',
            when: (a) => a.authType === 'Private Key File',
            default: process.env.HOME + '/.ssh/id_rsa'
        },
        {
            type: 'password',
            name: 'password',
            message: 'VPS Password:',
            when: (a) => a.authType === 'Password'
        }
    ]);

    // Construct ServerConfig
    const server: ServerConfig = {
        host: answers.host,
        username: answers.username,
        port: envConfig.port,
        privateKeyPath: answers.privateKeyPath || envConfig.privateKeyPath,
        privateKey: envConfig.privateKey,
        password: answers.password || envConfig.password,
    };

    // Construct ProjectConfig
    const project: ProjectConfig = {
        name: path.basename(process.cwd()),
        repoUrl: answers.repoUrl,
        branch: envConfig.branch || 'main',
        deployPath: answers.targetPath,
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
            onLog: (chunk: string) => {
                spinner.text = chunk.trim().substring(0, 80);
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
