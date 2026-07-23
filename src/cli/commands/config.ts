import { Command } from 'commander';
import { input, confirm, checkbox, select } from '@inquirer/prompts';
import chalk from 'chalk';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { CLIConfig, getConfig } from '../../core/config';

/**
 * Interactive update action for configuration
 */
export async function runConfigInteractive() {
    try {
        const currentConfig = await getConfig();
        const configPath = path.join(process.cwd(), 'pphatdev.json');

        console.log(chalk.blue('\nUpdating @pphatdev/registry preferences...'));
        console.log(chalk.gray('Existing config values will be used as defaults.\n'));

        const configName = await input({
            message: 'What is name of config ?',
            default: currentConfig.name || 'Default configuration',
        });

        // Determine default select value for useType
        let defaultUseType: 'icons' | 'components' | 'both' = 'icons';
        if (currentConfig.icons && currentConfig.components) {
            defaultUseType = 'both';
        } else if (currentConfig.components && !currentConfig.icons) {
            defaultUseType = 'components';
        }

        const useType = await select({
            message: 'What do you want to use ? (required must select one)',
            default: defaultUseType,
            choices: [
                { name: 'Components', value: 'components' },
                { name: 'Icons', value: 'icons' },
                { name: 'Both Components and Icons', value: 'both' }
            ]
        });

        const config: CLIConfig = {
            name: configName.trim(),
            icons: {
                svg: { dir: currentConfig.icons?.svg?.dir || 'public/icons', use: false },
                nextjs: { dir: currentConfig.icons?.nextjs?.dir || 'components/icons', use: false },
                nuxtjs: { dir: currentConfig.icons?.nuxtjs?.dir || 'components/icons', use: false }
            },
            components: {
                nextjs: { dir: currentConfig.components?.nextjs?.dir || 'components/ui', use: false },
                nuxtjs: { dir: currentConfig.components?.nuxtjs?.dir || 'components/ui', use: false }
            }
        };

        let iconFormats: string[] = [];
        let componentFormats: string[] = [];

        if (useType === 'icons' || useType === 'both') {
            const message = useType === 'both'
                ? 'Which directory you want to use for icons? (required must select one)'
                : 'Which directory you want to use ? (required must select one)';

            const defaultIconChoices = [];
            if (currentConfig.icons?.svg?.use) defaultIconChoices.push('svg');
            if (currentConfig.icons?.nextjs?.use) defaultIconChoices.push('nextjs');
            if (currentConfig.icons?.nuxtjs?.use) defaultIconChoices.push('nuxtjs');

            iconFormats = await checkbox({
                message,
                choices: [
                    { name: 'SVG format (.svg)', value: 'svg', checked: defaultIconChoices.includes('svg') },
                    { name: 'Nextjs format (.tsx)', value: 'nextjs', checked: defaultIconChoices.includes('nextjs') },
                    { name: 'Nuxtjs format (.vue)', value: 'nuxtjs', checked: defaultIconChoices.includes('nuxtjs') }
                ],
                validate: (choices) => choices.length > 0 || 'You must select at least one format.'
            });
        }

        if (useType === 'components' || useType === 'both') {
            const message = useType === 'both'
                ? 'Which directory you want to use for components? (required must select one)'
                : 'Which directory you want to use ? (required must select one)';

            const defaultCompChoices = [];
            if (currentConfig.components?.nextjs?.use) defaultCompChoices.push('nextjs');
            if (currentConfig.components?.nuxtjs?.use) defaultCompChoices.push('nuxtjs');

            componentFormats = await checkbox({
                message,
                choices: [
                    { name: 'Nextjs format (.tsx)', value: 'nextjs', checked: defaultCompChoices.includes('nextjs') },
                    { name: 'Nuxtjs format (.vue)', value: 'nuxtjs', checked: defaultCompChoices.includes('nuxtjs') }
                ],
                validate: (choices) => choices.length > 0 || 'You must select at least one format.'
            });
        }

        // Ask for Icon Directories
        if (iconFormats.includes('svg')) {
            const defaultDir = currentConfig.icons?.svg?.dir || 'public/icons';
            const dir = await input({ message: 'Where do you store icon of svg ?', default: defaultDir });
            config.icons!.svg = { dir: dir.trim(), use: true };
        }
        if (iconFormats.includes('nextjs')) {
            const defaultDir = currentConfig.icons?.nextjs?.dir || 'components/icons';
            const dir = await input({ message: 'Where do you store icon of nextjs ?', default: defaultDir });
            config.icons!.nextjs = { dir: dir.trim(), use: true };
        }
        if (iconFormats.includes('nuxtjs')) {
            const defaultDir = currentConfig.icons?.nuxtjs?.dir || 'components/icons';
            const dir = await input({ message: 'Where do you store icon of nuxtjs ?', default: defaultDir });
            config.icons!.nuxtjs = { dir: dir.trim(), use: true };
        }

        // Ask for Component Directories
        if (componentFormats.includes('nextjs')) {
            const defaultDir = currentConfig.components?.nextjs?.dir || 'components/ui';
            const dir = await input({ message: 'Where do you store component of nextjs ?', default: defaultDir });
            config.components!.nextjs = { dir: dir.trim(), use: true };
        }
        if (componentFormats.includes('nuxtjs')) {
            const defaultDir = currentConfig.components?.nuxtjs?.dir || 'components/ui';
            const dir = await input({ message: 'Where do you store component of nuxtjs ?', default: defaultDir });
            config.components!.nuxtjs = { dir: dir.trim(), use: true };
        }

        await fs.writeFile(configPath, JSON.stringify(config, null, 2));

        console.log(chalk.green(`\nSuccess! Configuration saved to pphatdev.json.`));
        console.log(chalk.gray(`Your preferences have been updated.\n`));

    } catch (error) {
        console.error(chalk.red('\nConfiguration update cancelled or failed.'), error);
        process.exit(1);
    }
}

/**
 * Config Command
 * @description View or update configuration (pphatdev.json)
 */
export const configCommand = new Command('config')
    .description('View or update configuration (pphatdev.json)')
    .addHelpText('after', `
${chalk.blue.bold('Examples:')}
  $ pphat config
  $ pphat config get
  $ pphat config get icons.nextjs.dir
  $ pphat config set icons.nextjs.use true
`)
    .action(async () => {
        await runConfigInteractive();
    });

configCommand
    .command('get [key]')
    .description('Get current configuration or a specific key')
    .addHelpText('after', `
${chalk.blue.bold('Examples:')}
  $ pphat config get
  $ pphat config get icons.nextjs.dir
`)
    .action(async (key?: string) => {
        const config = await getConfig();
        if (!key) {
            console.log(JSON.stringify(config, null, 2));
            return;
        }
        const parts = key.split('.');
        let val: any = config;
        for (const p of parts) {
            val = val?.[p];
        }
        if (val !== undefined) {
            console.log(typeof val === 'object' ? JSON.stringify(val, null, 2) : val);
        } else {
            console.log(chalk.yellow(`Key "${key}" not found in configuration.`));
        }
    });

configCommand
    .command('set <key> <value>')
    .description('Set a specific key in pphatdev.json')
    .addHelpText('after', `
${chalk.blue.bold('Examples:')}
  $ pphat config set icons.nextjs.use true
  $ pphat config set icons.nextjs.dir src/components/icons
`)
    .action(async (key: string, value: string) => {
        const config = await getConfig();
        const configPath = path.join(process.cwd(), 'pphatdev.json');

        const parts = key.split('.');
        let current: any = config;
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!current[part] || typeof current[part] !== 'object') {
                current[part] = {};
            }
            current = current[part];
        }

        const lastPart = parts[parts.length - 1];
        if (value === 'true') current[lastPart] = true;
        else if (value === 'false') current[lastPart] = false;
        else current[lastPart] = value;

        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
        console.log(chalk.green(`Updated ${key} = ${value} in pphatdev.json.`));
    });
