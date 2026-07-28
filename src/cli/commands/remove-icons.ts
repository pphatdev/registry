import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

import { getConfig } from '../../core/config';
import { fetchRegistryIndex, fetchRegistryItem } from '../../core/registry';
import { transformContent } from '../../compilers';

export interface RemoveIconsOptions {
    format?: 'nextjs' | 'nuxtjs' | 'svg';
    dir?: string;
}

/**
* Core remove-icons logic — reused by `pphat remove-icon` and `pphat remove icon`.
* Uses the same registry lookup as `add` so the files it deletes are exactly the
* ones an equivalent `add` would have written.
*/
export async function runRemoveIcons(names: string[], options: RemoveIconsOptions): Promise<void> {
    if (!names || names.length === 0) {
        console.error(chalk.red('Please provide at least one icon name.'));
        process.exit(1);
    }

    const spinner = ora('Fetching registry index...').start();

    try {
        const indexList = await fetchRegistryIndex();

        if (!indexList) {
            spinner.fail(chalk.red(`Failed to fetch registry index.`));
            return;
        }

        const config = await getConfig();

        for (const name of names) {
            spinner.start(`Looking up item "${name}"...`);

            const itemInfo = indexList.find(i => i.name.toLowerCase() === name.toLowerCase());
            if (!itemInfo) {
                spinner.fail(chalk.red(`Failed to find item "${name}" in the registry.`));
                continue;
            }

            const item = await fetchRegistryItem(itemInfo);
            if (!item) {
                spinner.fail(chalk.red(`Failed to fetch item content for "${name}".`));
                continue;
            }

            const isComponent = itemInfo.type === 'components' || itemInfo.repo === 'components';
            const configCategory = isComponent ? config.components : config.icons;

            const enabledFormats: ('nextjs' | 'nuxtjs' | 'svg')[] = [];
            if (options.format) {
                enabledFormats.push(options.format);
            } else {
                if (configCategory?.nextjs?.use) enabledFormats.push('nextjs');
                if (configCategory?.nuxtjs?.use) enabledFormats.push('nuxtjs');
                if (!isComponent && config.icons?.svg?.use) enabledFormats.push('svg');

                if (enabledFormats.length === 0) {
                    spinner.stop();
                    console.error(chalk.red('No formats configured or selected.'));
                    console.error(chalk.yellow(`Please specify a format using -f <format> or configure it in pphatdev.json.`));
                    process.exit(1);
                }
            }

            for (const format of enabledFormats) {
                let targetDir = process.cwd();

                if (options.dir) {
                    targetDir = path.join(process.cwd(), options.dir);
                } else {
                    const formatConfig = isComponent
                        ? config.components?.[format as 'nextjs' | 'nuxtjs']
                        : config.icons?.[format as 'nextjs' | 'nuxtjs' | 'svg'];

                    if (formatConfig && formatConfig.dir) {
                        targetDir = path.join(process.cwd(), formatConfig.dir);
                    } else {
                        targetDir = path.join(process.cwd(), isComponent ? 'components' : 'icons');
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
                        if (format === 'svg' && ext !== '.svg') continue;
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
                    spinner.succeed(chalk.green(`Removed ${name} from ${targetDir} (${removed} file${removed === 1 ? '' : 's'})${missing > 0 ? chalk.dim(`, ${missing} already gone`) : ''}`));
                } else {
                    spinner.warn(chalk.yellow(`No files for "${name}" found in ${targetDir} (format: ${format}).`));
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
* `pphat remove-icon` — hyphenated form.
* The new grammar `pphat remove icon <names...>` is handled by the parent `remove` command.
*/
export const removeIconCommand = new Command('remove-icon')
    .description('Remove previously downloaded icons from your project')
    .argument('[names...]', 'Names of the icons to remove (e.g. pphat remove-icon react vue)')
    .option('-f, --format <format>', 'Format to remove (svg, nextjs, nuxtjs)')
    .option('-d, --dir <dir>', 'Custom directory the icons were saved to')
    .addHelpText('after', `
${chalk.blue.bold('Examples:')}
  $ pphat remove-icon react vue github
  $ pphat remove-icon react -f nextjs
  $ pphat remove-icon github -f svg -d public/custom-icons
`)
    .action(runRemoveIcons);
