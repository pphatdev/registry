import { Command } from 'commander';
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

import { getConfig } from '../../core/config';
import { fetchRegistryIndex, fetchRegistryItem } from '../../core/registry';
import { transformContent } from '../../compilers';

/**
* Add Icon Command
* @description Download and copy icons or components into your project
* @param names Names of the items to download
* @param options Command options (format, custom dir)
* @returns void
*/
export const addCommand = new Command('add-icon')
    .alias('add')
    .description('Download and copy icons or components into your project')
    .argument('[names...]', 'Names of the icons to download (e.g. pphat add-icon react vue github)')
    .option('-f, --format <format>', 'Override format to download (svg, nextjs, nuxtjs)')
    .option('-d, --dir <dir>', 'Custom target directory to save downloaded items')
    .addHelpText('after', `
${chalk.blue.bold('Examples:')}
  $ pphat add-icon react vue github
  $ pphat add-icon react -f nextjs
  $ pphat add-icon github -f svg -d public/custom-icons
`)
    .action(async (names: string[], options: { format?: 'nextjs' | 'nuxtjs' | 'svg'; dir?: string }) => {
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
                spinner.start(`Fetching item "${name}" from registry...`);

                const itemInfo = indexList.find(i => i.name.toLowerCase() === name.toLowerCase());
                if (!itemInfo) {
                    spinner.fail(chalk.red(`Failed to find item "${name}". Please check if it exists in the registry.`));
                    continue;
                }

                spinner.text = `Fetching item for "${name}"...`;
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

                    if (!existsSync(targetDir)) {
                        await fs.mkdir(targetDir, { recursive: true });
                    }

                    for (const file of item.files) {
                        const ext = path.extname(file.path);
                        const itemName = file.path.replace(ext, '');

                        let finalContent = file.content;
                        let finalPath = file.path;

                        if (ext === '.svg') {
                            const transformed = transformContent(itemName, file.content, format);
                            finalContent = transformed.content;
                            finalPath = transformed.path;
                        } else {
                            if (format === 'nextjs' && ext !== '.tsx' && ext !== '.ts') continue;
                            if (format === 'nuxtjs' && ext !== '.vue' && ext !== '.js') continue;
                            if (format === 'svg' && ext !== '.svg') continue;
                        }

                        const targetPath = path.join(targetDir, finalPath);

                        if (existsSync(targetPath)) {
                            spinner.stop();
                            const overwrite = await confirm({
                                message: `The file ${finalPath} already exists in ${targetDir}. Do you want to overwrite it?`,
                                default: false,
                            });

                            if (!overwrite) {
                                console.log(chalk.yellow(`Skipped ${finalPath}.`));
                                spinner.start();
                                continue;
                            }
                            spinner.start();
                        }

                        await fs.writeFile(targetPath, finalContent);
                    }

                    spinner.succeed(chalk.green(`Successfully downloaded ${name} into ${targetDir} directory for format: ${format}`));
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
    });
