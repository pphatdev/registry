import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { fetchRegistryIndex } from '../../core/registry';

/**
* List Command
* @description List all available items in the registry (icons or components)
* @param type Type of packages to list (icons|components)
* @returns void
*/
export const listCommand = new Command('list')
    .alias('ls')
    .description('List all available items in the registry (icons or components)')
    .argument('<type>', 'Type of packages to list (icons|components)')
    .addHelpText('after', `
${chalk.blue.bold('Examples:')}
  $ pphat list icons
  $ pphat list components
  $ pphat ls icons
`)
    .action(async (type: string) => {
        if (type !== 'icons' && type !== 'components') {
            console.error(chalk.red('Invalid type. Must be "icons" or "components".'));
            process.exit(1);
        }

        const spinner = ora('Fetching available packages...').start();

        try {
            const indexList = await fetchRegistryIndex(type as 'icons' | 'components');

            if (!indexList) {
                spinner.fail(chalk.red(`Repository for ${type} not found or is empty.`));
                return;
            }

            spinner.stop();

            const items = indexList.filter(item => {
                const isComponent = item.type === 'components';
                return type === 'components' ? isComponent : !isComponent;
            });

            if (items.length === 0) {
                console.log(chalk.yellow(`No ${type} found.`));
                return;
            }

            let allItemsToDisplay: { category: string, name: string }[] = [];

            if (type === 'components') {
                allItemsToDisplay = items.map(item => ({ category: 'components', name: item.name }));
            } else {
                items.forEach(item => {
                    let category = item.type && item.type !== 'components' ? item.type : 'icons';
                    if (!item.type && item.target) {
                        const parts = item.target.split('/');
                        category = parts[0] === 'icons' && parts.length > 1 ? parts[1] : parts[0];
                    }
                    allItemsToDisplay.push({ category, name: item.name });
                });
                allItemsToDisplay.sort((a, b) => a.category.localeCompare(b.category));
            }

            let currentCategory = '';
            let count = 0;

            for (let i = 0; i < allItemsToDisplay.length; i++) {
                const item = allItemsToDisplay[i];
                if (item.category !== currentCategory) {
                    currentCategory = item.category;
                    const header = currentCategory === 'components'
                        ? 'Available components:'
                        : `Available ${currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1)} Icons:`;
                    console.log(chalk.blue.bold(`\n${header}\n`));
                }

                console.log(`  - ${chalk.green(item.name)}`);
                count++;

                if (count === 10 && i < allItemsToDisplay.length - 1) {
                    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
                    await new Promise<void>(resolve => {
                        rl.question(chalk.dim('\nPress Enter to show more (or type "q" to quit)... '), (answer: string) => {
                            rl.close();
                            if (answer.trim().toLowerCase() === 'q') {
                                console.log('');
                                process.exit(0);
                            }
                            resolve();
                        });
                    });
                    count = 0;
                }
            }
            console.log('');

        } catch (error) {
            spinner.fail(chalk.red('Failed to fetch packages.'));
            if (error instanceof Error) {
                console.error(chalk.red(error.message));
            } else {
                console.error(error);
            }
        }
    });
