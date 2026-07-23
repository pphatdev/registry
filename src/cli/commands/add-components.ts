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
* Add Component Command
* @description Download and copy components into your project
* @param names Names of the components to download
* @param options Command options (format, custom dir)
* @returns void
*/
export const addComponentCommand = new Command('add-component')
    .alias('add-comp')
    .description('Download and copy components into your project')
    .argument('[names...]', 'Names of the components to download (e.g. pphat add-component button card)')
    .option('-f, --format <format>', 'Override format to download (nextjs, nuxtjs)')
    .option('-d, --dir <dir>', 'Custom target directory to save downloaded components')
    .action(async (names: string[], options: { format?: 'nextjs' | 'nuxtjs'; dir?: string }) => {
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
                spinner.start(`Fetching component "${name}" from registry...`);

                const itemInfo = indexList.find(i => i.name.toLowerCase() === name.toLowerCase());
                if (!itemInfo) {
                    spinner.fail(chalk.red(`Failed to find component "${name}". Please check if it exists in the registry.`));
                    continue;
                }

                spinner.text = `Fetching component content for "${name}"...`;
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

                    spinner.succeed(chalk.green(`Successfully downloaded component ${name} into ${targetDir} directory for format: ${format}`));
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
