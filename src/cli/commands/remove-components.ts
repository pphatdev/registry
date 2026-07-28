import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

import { getConfig } from '../../core/config';
import { fetchRegistryIndex, fetchRegistryItem } from '../../core/registry';
import { transformContent } from '../../compilers';

export interface RemoveComponentsOptions {
    format?: 'nextjs' | 'nuxtjs';
    dir?: string;
}

/**
* Core remove-components logic — reused by `pphat remove-component` and `pphat remove component`.
*/
export async function runRemoveComponents(names: string[], options: RemoveComponentsOptions): Promise<void> {
    if (!names || names.length === 0) {
        console.error(chalk.red('Please provide at least one component name.'));
        process.exit(1);
    }

    const spinner = ora('Fetching registry index...').start();

    try {
        const indexList = await fetchRegistryIndex('components');

        if (!indexList) {
            spinner.fail(chalk.red(`Failed to fetch registry index for components.`));
            return;
        }

        const config = await getConfig();

        for (const name of names) {
            spinner.start(`Looking up component "${name}"...`);

            const itemInfo = indexList.find(i => i.name.toLowerCase() === name.toLowerCase());
            if (!itemInfo) {
                spinner.fail(chalk.red(`Failed to find component "${name}" in the registry.`));
                continue;
            }

            const item = await fetchRegistryItem(itemInfo);
            if (!item) {
                spinner.fail(chalk.red(`Failed to fetch component content for "${name}".`));
                continue;
            }

            const enabledFormats: ('nextjs' | 'nuxtjs')[] = [];
            if (options.format) {
                enabledFormats.push(options.format);
            } else {
                if (config.components?.nextjs?.use) enabledFormats.push('nextjs');
                if (config.components?.nuxtjs?.use) enabledFormats.push('nuxtjs');

                if (enabledFormats.length === 0) {
                    spinner.stop();
                    console.error(chalk.red('No component formats configured or selected.'));
                    console.error(chalk.yellow(`Please specify a format using -f <format> or configure components in pphatdev.json.`));
                    process.exit(1);
                }
            }

            for (const format of enabledFormats) {
                let targetDir = process.cwd();

                if (options.dir) {
                    targetDir = path.join(process.cwd(), options.dir);
                } else {
                    const formatConfig = config.components?.[format];
                    if (formatConfig && formatConfig.dir) {
                        targetDir = path.join(process.cwd(), formatConfig.dir);
                    } else {
                        targetDir = path.join(process.cwd(), 'components/ui');
                    }
                }

                let removed = 0;
                let missing = 0;

                for (const file of item.files) {
                    const ext = path.extname(file.path);
                    const itemName = file.path.replace(ext, '');

                    let finalPath = file.path;
                    if (ext === '.svg') {
                        finalPath = transformContent(itemName, file.content, format).path;
                    } else {
                        if (format === 'nextjs' && ext !== '.tsx' && ext !== '.ts') continue;
                        if (format === 'nuxtjs' && ext !== '.vue' && ext !== '.js') continue;
                    }

                    const targetPath = path.join(targetDir, finalPath);

                    if (existsSync(targetPath)) {
                        await fs.rm(targetPath);
                        removed++;
                    } else {
                        missing++;
                    }
                }

                if (removed > 0) {
                    spinner.succeed(chalk.green(`Removed component ${name} from ${targetDir} (${removed} file${removed === 1 ? '' : 's'})${missing > 0 ? chalk.dim(`, ${missing} already gone`) : ''}`));
                } else {
                    spinner.warn(chalk.yellow(`No files for component "${name}" found in ${targetDir} (format: ${format}).`));
                }
            }
        }

        spinner.stop();
    } catch (error) {
        spinner.fail(chalk.red('Process cancelled or failed.'));
        if (error instanceof Error) {
            console.error(chalk.red(error.message));
        } else {
            console.error(error);
        }
    }
}

/**
* `pphat remove-component` — hyphenated form (with `remove-comp` alias).
* The new grammar `pphat remove component <names...>` is handled by the parent `remove` command.
*/
export const removeComponentCommand = new Command('remove-component')
    .alias('remove-comp')
    .description('Remove previously downloaded components from your project')
    .argument('[names...]', 'Names of the components to remove (e.g. pphat remove-component button card)')
    .option('-f, --format <format>', 'Format to remove (nextjs, nuxtjs)')
    .option('-d, --dir <dir>', 'Custom directory the components were saved to')
    .addHelpText('after', `
${chalk.blue.bold('Examples:')}
  $ pphat remove-component button card
  $ pphat remove-comp modal -f nextjs
  $ pphat remove-component button -d src/components/ui
`)
    .action(runRemoveComponents);
