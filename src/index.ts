#!/usr/bin/env node

import { program } from './commands/root.js';
import { deployCommand } from './commands/deploy.js';
import { setupCommand } from './commands/setup.js';
import { ciGenerateCommand } from './commands/ci-generate.js';

program.addCommand(deployCommand);
program.addCommand(setupCommand);
program.addCommand(ciGenerateCommand);

program.parse(process.argv);

