#!/usr/bin/env node

import { program } from './commands/root.js';
import { deployCommand } from './commands/deploy.js';
import { setupCommand } from './commands/setup.js';

program.addCommand(deployCommand);
program.addCommand(setupCommand);

program.parse(process.argv);
