import { Command } from 'commander';
import { execSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, getProjectName } from '../utils/config.js';

export const buildCommand = new Command('build')
  .description('Build production Docker image with standardized tags')
  .action(() => {
    const config = loadConfig();
    let projectName = config?.project_name || getProjectName();

    const tags: string[] = [`${projectName}:latest`];

    // Add git short hash if in a repo
    try {
      const gitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
      tags.push(`${projectName}:${gitHash}`);
    } catch {
      // Not in a git repo or git not available
    }

    const tagArgs = tags.flatMap(t => ['-t', t]);
    const buildArgs = ['build', ...tagArgs, '.'];

    console.log(chalk.blue.bold('🔨 Building Docker image...\n'));
    console.log(chalk.cyan('Tags:'));
    tags.forEach(tag => {
      console.log(chalk.white(`  • ${chalk.bold(tag)}`));
    });
    console.log();

    const spinner = ora('Building image...').start();
    
    try {
      // Build with streaming output
      execSync(`docker ${buildArgs.join(' ')}`, { 
        stdio: ['inherit', 'pipe', 'pipe'],
        encoding: 'utf8'
      });
      
      spinner.succeed(chalk.green('Image built successfully!'));
      
      console.log(chalk.cyan('\nYour image is ready:'));
      tags.forEach(tag => {
        console.log(chalk.white(`  ${chalk.bold(tag)}`));
      });
      console.log();
      console.log(chalk.gray('To run: ') + chalk.bold(`docker run -p 8080:8080 ${tags[0]}`));
      console.log(chalk.gray('To push: ') + chalk.bold(`docker push ${tags[0]}\n`));
      
    } catch (error) {
      spinner.fail(chalk.red('Build failed'));
      if (error instanceof Error && 'stdout' in error) {
        console.error(chalk.red((error as any).stdout || error.message));
      }
      process.exit(1);
    }
  });
