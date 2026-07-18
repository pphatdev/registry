#!/usr/bin/env node

import { Command } from 'commander';
import { addCommand } from './cli/commands/add';
import { initCommand } from './cli/commands/init';

import chalk from 'chalk';

const program = new Command();

const WELCOME_MESSAGE = `
${chalk.blue.bold('  ____  ____  _   _    _  _____ ')}
${chalk.cyan.bold(' |  _ \\|  _ \\| | | |  / \\|_   _|')}
${chalk.blue.bold(' | |_) | |_) | |_| | / _ \\ | |  ')}
${chalk.cyan.bold(' |  __/|  __/|  _  |/ ___ \\| |  ')}
${chalk.blue.bold(' |_|   |_|   |_| |_/_/   \\_\\_|  ')}
${chalk.magenta('\n    Welcome to @pphatdev/registry! 🚀\n')}
`;

program
  .name('pphatdev')
  .description('CLI to download and manage custom UI components and icons')
  .version('1.0.0', '-v, -V, --version', 'Output the current version');

program.addCommand(addCommand);
program.addCommand(initCommand);

// Workaround for Windows appending '/registry' when running the scoped @pphatdev/registry alias
let args = process.argv;
if (args[2] === '/registry') {
  args = [...args.slice(0, 2), ...args.slice(3)];
}

if (args.length === 2 || (args.length === 3 && (args[2] === '-h' || args[2] === '--help'))) {
  console.log(WELCOME_MESSAGE);
}

program.parse(args);
