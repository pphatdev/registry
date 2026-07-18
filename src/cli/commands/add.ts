import { Command } from 'commander';
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

import { getConfig } from '../../core/config';
import { fetchRegistryIndex, fetchRegistryItem, RegistryItem } from '../../core/registry';
import { transformContent } from '../../compilers';

export const addCommand = new Command('add')
    .description('Download or copy item')
    .argument('[name]', 'Name of the item')
    .option('-f, --format <format>', 'Format to download (svg, nextjs, nuxtjs)')
    .action(async (name: string, options: { format?: 'nextjs' | 'nuxtjs' | 'svg' }) => {
        if (!name) {
            console.error(chalk.red('Please provide an item name.'));
            process.exit(1);
        }

        const spinner = ora(`Fetching item "${name}" from registry...`).start();

        try {
            const indexList = await fetchRegistryIndex();

            if (!indexList) {
                spinner.fail(chalk.red(`Failed to fetch registry index.`));
                return;
            }

            const itemInfo = indexList.find(i => i.name === name);
            if (!itemInfo) {
                spinner.fail(chalk.red(`Failed to find item "${name}". Please check if it exists in the registry.`));
                return;
            }

            spinner.text = `Fetching item for "${name}"...`;
            const item = await fetchRegistryItem(itemInfo);
            
            if (!item) {
                spinner.fail(chalk.red(`Failed to fetch item content for "${name}".`));
                return;
            }

            const config = await getConfig();
            
            const enabledFormats: ('nextjs'|'nuxtjs'|'svg')[] = [];
            if (options.format) {
                enabledFormats.push(options.format);
            } else {
                if (config.use?.nextjs) enabledFormats.push('nextjs');
                if (config.use?.nuxtjs) enabledFormats.push('nuxtjs');
                if (config.use?.svg) enabledFormats.push('svg');
                if (enabledFormats.length === 0) enabledFormats.push('svg');
            }

            for (const format of enabledFormats) {
                const isComponent = itemInfo.type === 'components';
                let targetDir = process.cwd();
                
                if (config[format]) {
                    const dirConfig = isComponent ? config[format]?.componentsDir : config[format]?.iconsDir;
                    if (dirConfig) {
                        targetDir = path.join(process.cwd(), dirConfig);
                    } else {
                        // Fallback to old dir schema if they didn't update config
                        targetDir = path.join(process.cwd(), (config[format] as any).dir || (isComponent ? 'components' : 'icons'));
                    }
                } else {
                    targetDir = path.join(process.cwd(), isComponent ? 'components' : 'icons');
                }
                
                if (!existsSync(targetDir)) {
                    await fs.mkdir(targetDir, { recursive: true });
                }

                for (const file of item.files) {
                    const ext = path.extname(file.path);
                    const itemName = file.path.replace(ext, '');
                    
                    // If it's a raw component (.tsx, .vue) from the registry, don't run transformContent on it if it's already the right format.
                    // Actually, our CLI transforms SVG into Vue/React. If the registry gives us raw SVG, we transform it.
                    // If the registry gives us `.tsx` and the format is `nextjs`, we just write it.
                    let finalContent = file.content;
                    let finalPath = file.path;
                    
                    if (ext === '.svg') {
                        const transformed = transformContent(itemName, file.content, format);
                        finalContent = transformed.content;
                        finalPath = transformed.path;
                    } else {
                        // It's a pre-built or custom component from the registry
                        // We only want to write it if it matches the current format request
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
                spinner.start(`Processing next format...`);
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
