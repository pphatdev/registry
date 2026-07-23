#!/usr/bin/env node

import { Command } from 'commander';
import { addCommand } from './cli/commands/add-icons';
import { addComponentCommand } from './cli/commands/add-components';
import { initCommand } from './cli/commands/init';
import { listCommand } from './cli/commands/list';
import { configCommand } from './cli/commands/config';
import chalk from 'chalk';
import { version, name } from '../package.json';

const program = new Command();

async function checkUpdate() {
  try {
    const res = await fetch(`https://registry.npmjs.org/${name}/latest`, {
      signal: AbortSignal.timeout(1500)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.version && data.version !== version) {
        console.log(chalk.yellow(`\n📦 Update available! ${chalk.dim(version)} → ${chalk.green(data.version)}`));
        console.log(chalk.cyan(`Run ${chalk.bold(`npm install -g ${name}`)} or use ${chalk.bold(`npx ${name}@latest`)} to get the latest version.\n`));
      }
    }
  } catch (err) {
    // silently ignore network errors
  }
}

const WELCOME_MESSAGE = `
${chalk.blue.bold('  ____  ____  _   _    _  _____ ')}
${chalk.cyan.bold(' |  _ \\|  _ \\| | | |  / \\|_   _|')}
${chalk.blue.bold(' | |_) | |_) | |_| | / _ \\ | |  ')}
${chalk.cyan.bold(' |  __/|  __/|  _  |/ ___ \\| |  ')}
${chalk.blue.bold(' |_|   |_|   |_| |_/_/   \\_\\_|  ')}
${chalk.magenta('\n    Welcome to @pphatdev/registry! 🚀\n')}
`;

program
  .name('pphat')
  .description('A powerful and extremely fast CLI tool to instantly download and manage custom UI components and icons.')
  .version(version, '-v, -V, --version', 'Output the current version')
  .addHelpText('after', `
${chalk.blue.bold('Examples:')}
  $ pphat init
  $ pphat add-icon react vue github
  $ pphat add-icon react -f nextjs -d src/components/icons
  $ pphat add-component button card
  $ pphat list icons
  $ pphat list components
  $ pphat config
  $ pphat config get icons.nextjs.dir
  $ pphat config set icons.nextjs.use true
`);

program.addCommand(addCommand);
program.addCommand(addComponentCommand);
program.addCommand(initCommand);
program.addCommand(listCommand);
program.addCommand(configCommand);

// Workaround for Windows appending '/registry' when running the scoped @pphatdev/registry alias
let args = process.argv;
if (args[2] === '/registry') {
  args = [...args.slice(0, 2), ...args.slice(3)];
}

async function main() {
  if (args.length === 2 || (args.length === 3 && (args[2] === '-h' || args[2] === '--help'))) {
    console.log(WELCOME_MESSAGE);
  }

  await program.parseAsync(args);
  await checkUpdate();
}

main();
