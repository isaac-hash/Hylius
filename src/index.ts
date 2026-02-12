#!/usr/bin/env node

import { program } from './commands/root.js';
import { deploy } from './commands/deploy.js';

program.command('deploy')
    .description('Deploy your application to a remote VPS')
    .action(deploy);

program.parse(process.argv);
