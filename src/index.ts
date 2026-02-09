#!/usr/bin/env node

import { program } from './commands/root.js';

program.parse(process.argv);
