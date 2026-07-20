import { Command } from 'commander';
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Constants
*/
const DEFAULT_REGISTRY_URL = 'https://raw.githubusercontent.com/pphatdev/icons/main';
const REGISTRY_URL = process.env.PPHAT_REGISTRY_URL || DEFAULT_REGISTRY_URL;

/**
 * Types
*/
interface RegistryItemFile {
    path: string;
    content: string;
}

interface RegistryItem {
    name: string;
    files: RegistryItemFile[];
}

interface RegistryIndexItem {
    name: string;
    target: string;
}

import { CLIConfig, getConfig } from '../core/config';


/**
* Convert to Pascal Case
* @description Converts a given string (e.g., kebab-case) to PascalCase
* @param str The string to convert
* @returns The PascalCase string
*/
function toPascalCase(str: string): string {
    return str.replace(/(^\w|-\w)/g, (clearAndUpper) => clearAndUpper.replace(/-/, '').toUpperCase());
}

/**
* Format SVG Parts
* @description Parses and formats the internal parts of an SVG string for component generation
* @param content The raw SVG content string
* @param baseIndent The base indentation level
* @param tabSize The size of a tab in spaces
* @param isReact Whether the target format is React (TSX)
* @returns Formatted SVG attributes and inner content, or null if parsing fails
*/
function formatSvgParts(content: string, baseIndent: number, tabSize: number, isReact: boolean): { attributes: string, rawAttributes: string, inner: string } | null {
    const svgMatch = content.match(/<svg([^>]*)>([\s\S]*?)<\/svg>/i);
    if (!svgMatch) return null;

    const attrIndent = baseIndent + tabSize;
    const attrString = svgMatch[1].trim();
    const attrsMatch = attrString.match(/[^\s="']+=(?:"[^"]*"|'[^']*')|[^\s="']+/g) || [];
    const formattedAttributes = attrsMatch.map(attr => ' '.repeat(attrIndent) + attr).join('\n');

    let innerContent = svgMatch[2].trim();
    innerContent = innerContent.replace(/(>)\s*(<)/g, '$1\n$2');
    
    const styleMatch = innerContent.match(/<style>([\s\S]*?)<\/style>/i);
    let minStyleIndent = 0;
    if (styleMatch) {
        const styleLines = styleMatch[1].split('\n').filter(l => l.trim());
        if (styleLines.length > 0) {
            minStyleIndent = Math.min(...styleLines.map(l => l.match(/^\s*/)?.[0].length || 0));
        }
    }

    if (isReact) {
        innerContent = innerContent.replace(/<style>([\s\S]*?)<\/style>/gi, '<style>{`\n$1\n`}</style>');
    }

    const lines = innerContent.split('\n');
    let formattedInner = [];
    let currentIndent = attrIndent;
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('</') && trimmed !== '</style>') {
            currentIndent = Math.max(attrIndent, currentIndent - tabSize);
            formattedInner.push(' '.repeat(currentIndent) + trimmed);
        } else if (isReact && trimmed === '`}</style>') {
            formattedInner.push(' '.repeat(attrIndent) + trimmed);
        } else if (trimmed.startsWith('<style')) {
            formattedInner.push(' '.repeat(attrIndent) + (isReact ? '<style>{`' : '<style>'));
        } else if (trimmed.startsWith('<') && !trimmed.startsWith('</')) {
            formattedInner.push(' '.repeat(currentIndent) + trimmed);
            if (!trimmed.endsWith('/>') && !trimmed.includes('</')) {
                currentIndent += tabSize;
            }
        } else {
            let spaces = line.match(/^\s*/)?.[0].length || 0;
            let normalizedSpaces = Math.max(0, spaces - minStyleIndent) + attrIndent + tabSize;
            formattedInner.push(' '.repeat(normalizedSpaces) + trimmed);
        }
    }
    
    return { attributes: formattedAttributes, rawAttributes: attrString, inner: formattedInner.join('\n') };
}

/**
* Transform Content
* @description Transforms raw registry content into the requested framework format (svg, nextjs, nuxtjs)
* @param name The original file or item name
* @param content The raw string content of the item
* @param format The target output format
* @returns The transformed file path and string content
*/
function transformContent(name: string, content: string, format: string): { path: string, content: string } {
    if (format === 'nextjs') {
        const componentName = `${toPascalCase(name)}Icon`;
        let reactContent = content.replace(/class=/g, 'className=');
        
        const parts = formatSvgParts(reactContent, 4, 4, true);
        if (!parts) {
            reactContent = reactContent.replace(/<svg /, '<svg {...props} ');
            const fallbackContent = `import React, { forwardRef } from 'react';\n\nexport const ${componentName} = forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>((props, ref) => (\n  ${reactContent}\n));\n\n${componentName}.displayName = '${componentName}';\n`;
            return { path: `${name}.tsx`, content: fallbackContent };
        }

        const finalContent = `import React, { forwardRef } from 'react';\n\nexport const ${componentName} = forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>((props, ref) => (\n    <svg\n        ref={ref}\n${parts.attributes}\n        {...props}\n    >\n${parts.inner}\n    </svg>\n));\n\n${componentName}.displayName = '${componentName}';\n`;
        return { path: `${name}.tsx`, content: finalContent };
    } else if (format === 'nuxtjs') {
        const parts = formatSvgParts(content, 4, 4, false);
        if (!parts) {
            return { path: `${name}.vue`, content: `<template>\n    ${content}\n</template>\n` };
        }
        
        const finalContent = `<template>\n    <svg ${parts.rawAttributes}>\n${parts.inner}\n    </svg>\n</template>\n`;
        return { path: `${name}.vue`, content: finalContent };
    }
    return { path: `${name}.svg`, content };
}



/**
 * Command Definition
*/
/**
* Legacy Download Command
* @description Download or copy an item into your project
* @param name Name of the item
* @param options Command options (e.g., format)
* @returns void
*/
export const downloadCommand = new Command('add')
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
            let item: RegistryItem;

            let indexList: RegistryIndexItem[] = [];
            const indexUrl = `${REGISTRY_URL}/index.json`;
            const response = await fetch(indexUrl);

            if (!response.ok) {
                spinner.fail(chalk.red(`Failed to fetch registry index (HTTP ${response.status}).`));
                return;
            }

            indexList = (await response.json()) as RegistryIndexItem[];

            const iconInfo = indexList.find(i => i.name === name);
            if (!iconInfo) {
                spinner.fail(chalk.red(`Failed to find item "${name}". Please check if it exists in the registry.`));
                return;
            }

            spinner.text = `Fetching item for "${name}"...`;
            const targetJson = iconInfo.target.replace('.svg', '.json');
            const itemUrl = `${REGISTRY_URL}/${targetJson}`;
            const itemResponse = await fetch(itemUrl);
            
            if (!itemResponse.ok) {
                spinner.fail(chalk.red(`Failed to fetch item content for "${name}" (HTTP ${itemResponse.status}).`));
                return;
            }

            item = (await itemResponse.json()) as RegistryItem;
            const config = await getConfig();
            
            const enabledFormats: ('nextjs'|'nuxtjs'|'svg')[] = [];
            if (options.format) {
                enabledFormats.push(options.format);
            } else {
                if (config.icons?.nextjs?.use || config.components?.nextjs?.use) enabledFormats.push('nextjs');
                if (config.icons?.nuxtjs?.use || config.components?.nuxtjs?.use) enabledFormats.push('nuxtjs');
                if (config.icons?.svg?.use) enabledFormats.push('svg');
                if (enabledFormats.length === 0) enabledFormats.push('svg');
            }

            for (const format of enabledFormats) {
                let dirFromConfig = 'icons';
                if (format === 'nextjs') {
                    dirFromConfig = config.icons?.nextjs?.dir || config.components?.nextjs?.dir || 'components';
                } else if (format === 'nuxtjs') {
                    dirFromConfig = config.icons?.nuxtjs?.dir || config.components?.nuxtjs?.dir || 'components';
                } else if (format === 'svg') {
                    dirFromConfig = config.icons?.svg?.dir || 'icons';
                }

                const targetDir = path.join(process.cwd(), dirFromConfig);
                
                if (!existsSync(targetDir)) {
                    await fs.mkdir(targetDir, { recursive: true });
                }

                for (const file of item.files) {
                    const iconName = file.path.replace('.svg', '');
                    const transformed = transformContent(iconName, file.content, format);
                    const targetPath = path.join(targetDir, transformed.path);
                    
                    if (existsSync(targetPath)) {
                        spinner.stop();
                        const overwrite = await confirm({
                            message: `The file ${transformed.path} already exists in ${targetDir}. Do you want to overwrite it?`,
                            default: false,
                        });
                        
                        if (!overwrite) {
                            console.log(chalk.yellow(`Skipped ${transformed.path}.`));
                            spinner.start();
                            continue;
                        }
                        spinner.start();
                    }

                    await fs.writeFile(targetPath, transformed.content);
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
