import { Command } from 'commander';
import { spawn } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from '../utils/config.js';

export const devCommand = new Command('dev')
  .description('Start the development environment')
  .option('-d, --detach', 'Run in detached mode')
  .option('--watch', 'Enable hot-reload (Docker Compose watch)')
  .action((options) => {
    console.log(chalk.blue.bold('🚀 Starting development environment...\n'));

    // Load config to show project name
    const config = loadConfig();
    if (config && config.project_name) {
      console.log(chalk.cyan(`Project: ${chalk.bold(config.project_name)}\n`));
    }

    const dockerArgs = ['compose', 'up', '--build'];
    if (options.detach) {
      dockerArgs.push('--detach');
    }
    if (options.watch) {
      dockerArgs.push('--watch');
    }

    const spinner = ora('Building and starting containers...').start();
    
    // Use spawn instead of execSync for real-time streaming output
    const dockerProcess = spawn('docker', dockerArgs, {
      stdio: options.detach ? 'pipe' : 'inherit'
    });

    if (options.detach) {
      dockerProcess.stdout?.on('data', (data) => {
        spinner.text = data.toString().trim();
      });

      dockerProcess.stderr?.on('data', (data) => {
        spinner.text = chalk.yellow(data.toString().trim());
      });
    } else {
      spinner.stop();
    }

    dockerProcess.on('close', (code) => {
      if (code === 0) {
        if (options.detach) {
          spinner.succeed(chalk.green('Containers started in detached mode'));
          console.log(chalk.cyan('\nTo view logs: ') + chalk.bold('docker compose logs -f'));
          console.log(chalk.cyan('To stop: ') + chalk.bold('docker compose down\n'));
        }
      } else {
        spinner.fail(chalk.red(`Docker compose exited with code ${code}`));
        process.exit(code || 1);
      }
    });

    dockerProcess.on('error', (error) => {
      spinner.fail(chalk.red('Failed to start docker compose'));
      console.error(chalk.red(error.message));
      process.exit(1);
    });
  });
