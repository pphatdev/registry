#!/usr/bin/env node

import { Command } from 'commander';
import { addCommand } from './cli/commands/add-icons';
import { addComponentCommand } from './cli/commands/add-components';
import { initCommand } from './cli/commands/init';
import { listCommand } from './cli/commands/list';
import { configCommand } from './cli/commands/config';
import { statsCommand } from './cli/commands/stats';
import { record as recordTelemetry } from './core/telemetry';
import chalk from 'chalk';
import { version, name } from '../package.json';

const program = new Command();

export const invokedAs = process.env.PPHAT_INVOKED_AS ?? 'pphat';

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
  .name(invokedAs)
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
program.addCommand(statsCommand);

async function main() {
  const args = process.argv;
  if (args.length === 2 || (args.length === 3 && (args[2] === '-h' || args[2] === '--help'))) {
    console.log(WELCOME_MESSAGE);
  }

  const started = Date.now();
  const command = args[2] && !args[2].startsWith('-') ? args[2] : '(root)';
  const cmdArgs = args.slice(3);
  let success = true;

  try {
    await program.parseAsync(args);
  } catch (err) {
    success = false;
    throw err;
  } finally {
    await recordTelemetry({
      alias: invokedAs,
      command,
      args: cmdArgs,
      version,
      success,
      durationMs: Date.now() - started,
    });
  }

  await checkUpdate();
}

main();
