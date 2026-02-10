import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './init.js';
import { devCommand } from './dev.js';
import { buildCommand } from './build.js';

export const program = new Command()
  .name('hylius')
  .description(chalk.cyan('A CLI tool to initialize and manage Docker configurations for development'))
  .version('1.0.0');

// Add subcommands
program.addCommand(initCommand);
program.addCommand(devCommand);
program.addCommand(buildCommand);
