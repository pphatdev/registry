import { Command } from 'commander';
import { input, confirm, checkbox } from '@inquirer/prompts';
import chalk from 'chalk';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const initCommand = new Command('init')
    .description('Initialize configuration for pphatdev CLI')
    .action(async () => {
        try {
            console.log(chalk.blue('\nWelcome to @pphatdev/registry initialization!'));
            console.log(chalk.gray('This will create a pphatdev.json config file in your project.\n'));

            const selectedFormats = await checkbox({
                message: 'Which formats would you like to download components and icons in? (Select all that apply)',
                choices: [
                    { name: 'SVG (.svg)', value: 'svg', checked: true },
                    { name: 'Next.js component (.tsx)', value: 'nextjs' },
                    { name: 'Nuxt.js component (.vue)', value: 'nuxtjs' }
                ]
            });

            if (selectedFormats.length === 0) {
                console.log(chalk.yellow('No formats selected. Defaulting to SVG.'));
                selectedFormats.push('svg');
            }

            const config: any = {
                use: {
                    nextjs: selectedFormats.includes('nextjs'),
                    nuxtjs: selectedFormats.includes('nuxtjs'),
                    svg: selectedFormats.includes('svg')
                }
            };

            for (const format of selectedFormats) {
                const defaultDir = format === 'svg' ? 'icons' : `components`;
                const dir = await input({
                    message: `Where would you like to store ${format} items?`,
                    default: defaultDir,
                });
                config[format] = { dir: dir.trim() };
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
