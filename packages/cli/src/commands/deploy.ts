import { Command } from 'commander';
import inquirer from 'inquirer';
import dotenv from 'dotenv';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { deploy as coreDeploy, DeployOptions, ServerConfig, ProjectConfig, SSHClient } from '@hylius/core';
import { ensureDockerArtifacts } from './init.js';
import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';

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
            name: 'port',
            message: 'SSH Port:',
            default: envConfig.port || 22,
            validate: (input) => !isNaN(parseInt(input)) || 'Port must be a number'
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
        port: parseInt(answers.port),
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
    let server: ServerConfig;
    let project: ProjectConfig;

    try {
        const config = await getConfiguration();
        server = config.server;
        project = config.project;

        const spinner = ora('Starting deployment...').start();

        // Handle local deployment bundling and upload
        const isLocal = project.repoUrl === '.' || project.repoUrl.startsWith('./') || project.repoUrl.startsWith('../') || path.isAbsolute(project.repoUrl);

        if (isLocal) {
            const localSourcePath = path.resolve(project.repoUrl);
            const bundleName = `hylius-bundle-${Date.now()}.tar.gz`;
            const localBundlePath = path.join(os.tmpdir(), bundleName);
            const remoteBundlePath = `/tmp/${bundleName}`;

            spinner.text = 'Checking Docker artifacts...';
            const artifactResult = ensureDockerArtifacts(localSourcePath);
            if (artifactResult.generated) {
                spinner.info(chalk.cyan(`No Dockerfile/compose.yaml found. Generated templates for detected type: ${artifactResult.projectType}`));
                spinner.start('Starting deployment...');
            }

            spinner.text = 'Bundling local project...';
            try {
                // Use tar to bundle the directory, excluding common heavy folders
                // Using spawnSync for better cross-platform argument handling (Windows backslashes etc)
                const tarResult = spawnSync('tar', [
                    '-czf', localBundlePath,
                    '--exclude=node_modules',
                    '--exclude=.git',
                    '--exclude=.next',
                    '--exclude=dist',
                    '-C', localSourcePath,
                    '.' // <-- The target path must be the very last argument
                ]);

                if (tarResult.status !== 0) {
                    const errorMsg = tarResult.stderr?.toString() || tarResult.error?.message || 'Unknown error';
                    throw new Error(errorMsg);
                }
            } catch (error: any) {
                spinner.fail(chalk.red(`Bundling failed: ${error.message}`));
                process.exit(1);
            }

            spinner.text = 'Connecting for upload...';
            const client = new SSHClient(server);
            try {
                await client.connect();
                spinner.text = `Uploading bundle to ${server.host}...`;
                await client.uploadFile(localBundlePath, remoteBundlePath);

                project.repoUrl = 'local';
                project.localBundlePath = remoteBundlePath;
                spinner.succeed(chalk.dim('Local bundle uploaded.'));
                spinner.start('Proceeding with deployment...');
            } catch (error: any) {
                spinner.fail(chalk.red(`Upload failed: ${error.message}`));
                if (fs.existsSync(localBundlePath)) fs.unlinkSync(localBundlePath);
                process.exit(1);
            } finally {
                client.end();
                if (fs.existsSync(localBundlePath)) fs.unlinkSync(localBundlePath);
            }
        }

        const deployOptions: DeployOptions = {
            server,
            project,
            trigger: 'cli',
            onLog: (chunk: string) => {
                // Clear the spinner temporarily to print the log cleanly
                spinner.clear();
                // Print the raw server logs directly to your terminal
                console.log(chalk.gray(`[Server] ${chunk.trim()}`));
                // Keep the spinner alive
                spinner.text = 'Deploying...';
            }
        };

        const result = await coreDeploy(deployOptions);

        if (result.success) {
            spinner.succeed(chalk.green(`Deployment Successful! Release ID: ${result.releaseId}`));
            console.log(chalk.dim(`Duration: ${result.durationMs}ms`));
            console.log(chalk.dim(`Commit: ${result.commitHash || 'N/A'}`));
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
