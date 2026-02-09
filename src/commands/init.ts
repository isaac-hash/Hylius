import { Command } from 'commander';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { detectProjectType } from '../utils/detect.js';
import { writeConfig, getProjectName } from '../utils/config.js';
import * as templates from '../templates/index.js';

export const initCommand = new Command('init')
  .description('Initialize a new anvil project')
  .option('--skip-docker', "Don't run docker init")
  .option('--skip-ci', "Don't generate GitHub Actions workflow")
  .action(async (options) => {
    console.log(chalk.blue.bold('🔍 Detecting project type...\n'));

    const projectType = detectProjectType();
    if (projectType === 'unknown') {
      console.log(chalk.yellow('⚠️  Could not detect project type automatically.\n'));
    }

    // Run docker init unless skipped
    if (!options.skipDocker) {
      if (projectType !== 'unknown') {
        console.log(chalk.green(`✨ ${capitalize(projectType)} detected. Using anvil optimized setup...\n`));
        
        const spinner = ora('Generating Docker configuration...').start();
        try {
          generateConfig(projectType);
          spinner.succeed(chalk.green('Docker configuration generated'));
        } catch (error) {
          spinner.fail(chalk.red('Failed to generate config'));
          console.error(chalk.red(error instanceof Error ? error.message : String(error)));
          process.exit(1);
        }
      } else {
        console.log(chalk.cyan('🐳 Running standard docker init...\n'));
        try {
          execSync('docker init', { stdio: 'inherit' });
        } catch (error) {
          console.error(chalk.red('❌ docker init failed'));
          process.exit(1);
        }
      }
    }

    // Generate anvil.yaml
    const spinner = ora('Creating anvil.yaml...').start();
    const config = {
      project_name: getProjectName(),
      type: projectType,
    };
    writeConfig(config);
    spinner.succeed(chalk.green('Created anvil.yaml'));

    // Generate basic GitHub Actions CI
    if (!options.skipCi) {
      const ciSpinner = ora('Creating GitHub Actions workflow...').start();
      const workflowDir = '.github/workflows';
      fs.mkdirSync(workflowDir, { recursive: true });
      
      const ciContent = `name: CI
on: [push, pull_request]
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker image
        run: docker build -t \${{ secrets.DOCKER_REPO }} .
`;
      
      const ciPath = path.join(workflowDir, 'ci.yaml');
      fs.writeFileSync(ciPath, ciContent, 'utf8');
      ciSpinner.succeed(chalk.green('Created .github/workflows/ci.yaml'));
    }

    console.log(chalk.green.bold('\n🚀 anvil initialization complete!'));
    console.log(chalk.cyan(`\nNext steps:`));
    console.log(chalk.white(`  $ ${chalk.bold('anvil dev')}  ${chalk.dim('# Start development environment')}`));
    console.log(chalk.white(`  $ ${chalk.bold('anvil build')} ${chalk.dim('# Build production image')}\n`));
  });

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function generateConfig(projectType: string): void {
  let dockerfile: string;
  let compose: string;
  let dockerignore = templates.nodeDockerignore; // Default ignore list

  switch (projectType) {
    case 'vite':
      dockerfile = templates.viteDockerfile;
      compose = templates.viteCompose;
      break;
    case 'next':
      dockerfile = templates.nextDockerfile;
      compose = templates.nextCompose;
      break;
    case 'node':
      dockerfile = templates.nodeDockerfile;
      compose = templates.nodeCompose;
      break;
    case 'python':
      dockerfile = templates.pythonDockerfile;
      compose = templates.pythonCompose;
      break;
    case 'go':
      dockerfile = templates.goDockerfile;
      compose = templates.goCompose;
      break;
    case 'java':
      dockerfile = templates.javaDockerfile;
      compose = templates.javaCompose;
      break;
    case 'php':
      dockerfile = templates.phpDockerfile;
      compose = templates.phpCompose;
      break;
    default:
      throw new Error(`Unsupported project type: ${projectType}`);
  }

  fs.writeFileSync('Dockerfile', dockerfile, 'utf8');
  fs.writeFileSync('compose.yaml', compose, 'utf8');
  fs.writeFileSync('.dockerignore', dockerignore, 'utf8');
  console.log(chalk.gray(`   Created: Dockerfile, compose.yaml, .dockerignore`));
}
