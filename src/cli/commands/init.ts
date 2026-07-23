import { Command } from 'commander';
import { input, confirm, checkbox, select } from '@inquirer/prompts';
import chalk from 'chalk';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { CLIConfig } from '../../core/config';

/**
* Init Command
* @description Initialize configuration (pphatdev.json) and set up your project preferences
* @returns void
*/
export const initCommand = new Command('init')
    .description('Initialize configuration (pphatdev.json) and set up your project preferences')
    .addHelpText('after', `
${chalk.blue.bold('Examples:')}
  $ pphat init
`)
    .action(async () => {
        try {
            console.log(chalk.blue('\nWelcome to @pphatdev/registry initialization!'));
            console.log(chalk.gray('This will create a pphatdev.json config file in your project.\n'));

            const configName = await input({
                message: 'What is name of config ?',
                default: 'Default configuration',
            });

            const useType = await select({
                message: 'What do you want to use ? (required must select one)',
                choices: [
                    { name: 'Components', value: 'components' },
                    { name: 'Icons', value: 'icons' },
                    { name: 'Both Components and Icons', value: 'both' }
                ]
            });

            const config: CLIConfig = {
                name: configName.trim(),
                icons: {
                    svg: { dir: 'public/icons', use: false },
                    nextjs: { dir: 'components/icons', use: false },
                    nuxtjs: { dir: 'components/icons', use: false }
                },
                components: {
                    nextjs: { dir: 'components/ui', use: false },
                    nuxtjs: { dir: 'components/ui', use: false }
                }
            };

            let iconFormats: string[] = [];
            let componentFormats: string[] = [];

            if (useType === 'icons' || useType === 'both') {
                const message = useType === 'both'
                    ? 'Which directory you want to use for icons? (required must select one)'
                    : 'Which directory you want to use ? (required must select one)';
                iconFormats = await checkbox({
                    message,
                    choices: [
                        { name: 'SVG format (.svg)', value: 'svg' },
                        { name: 'Nextjs format (.tsx)', value: 'nextjs' },
                        { name: 'Nuxtjs format (.vue)', value: 'nuxtjs' }
                    ],
                    validate: (choices) => choices.length > 0 || 'You must select at least one format.'
                });
            }

            if (useType === 'components' || useType === 'both') {
                const message = useType === 'both'
                    ? 'Which directory you want to use for components? (required must select one)'
                    : 'Which directory you want to use ? (required must select one)';
                componentFormats = await checkbox({
                    message,
                    choices: [
                        { name: 'Nextjs format (.tsx)', value: 'nextjs' },
                        { name: 'Nuxtjs format (.vue)', value: 'nuxtjs' }
                    ],
                    validate: (choices) => choices.length > 0 || 'You must select at least one format.'
                });
            }

            // Ask for Icon Directories
            if (iconFormats.includes('svg')) {
                const dir = await input({ message: 'Where do you store icon of svg ?', default: 'public/icons' });
                config.icons!.svg = { dir: dir.trim(), use: true };
            }
            if (iconFormats.includes('nextjs')) {
                const dir = await input({ message: 'Where do you store icon of nextjs ?', default: 'components/icons' });
                config.icons!.nextjs = { dir: dir.trim(), use: true };
            }
            if (iconFormats.includes('nuxtjs')) {
                const dir = await input({ message: 'Where do you store icon of nuxtjs ?', default: 'components/icons' });
                config.icons!.nuxtjs = { dir: dir.trim(), use: true };
            }

            // Ask for Component Directories
            if (componentFormats.includes('nextjs')) {
                const dir = await input({ message: 'Where do you store component of nextjs ?', default: 'components/ui' });
                config.components!.nextjs = { dir: dir.trim(), use: true };
            }
            if (componentFormats.includes('nuxtjs')) {
                const dir = await input({ message: 'Where do you store component of nuxtjs ?', default: 'components/ui' });
                config.components!.nuxtjs = { dir: dir.trim(), use: true };
            }

            const configPath = path.join(process.cwd(), 'pphatdev.json');

            // Check if it already exists
            if (existsSync(configPath)) {
                console.warn(chalk.yellow('\nWarning: pphatdev.json already exists in this directory.'));
                const overwrite = await confirm({
                    message: 'Do you want to overwrite it?',
                    default: false,
                });

                if (!overwrite) {
                    console.log(chalk.gray('Initialization cancelled.'));
                    return;
                }
            }

            await fs.writeFile(configPath, JSON.stringify(config, null, 2));

            console.log(chalk.green(`\nSuccess! Configuration saved to pphatdev.json.`));
            console.log(chalk.gray(`Your items will be saved to your configured directories.\n`));

        } catch (error) {
            console.error(chalk.red('\nInitialization cancelled or failed.'), error);
            process.exit(1);
        }
    });
