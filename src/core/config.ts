import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import chalk from 'chalk';

export interface CLIConfig {
    name?: string;
    icons?: {
        svg?: { dir?: string; use?: boolean };
        nextjs?: { dir?: string; use?: boolean };
        nuxtjs?: { dir?: string; use?: boolean };
    };
    components?: {
        nextjs?: { dir?: string; use?: boolean };
        nuxtjs?: { dir?: string; use?: boolean };
    };
}

/**
* Get Configuration
* @description Retrieves the CLI configuration from local files or falls back to defaults
* @returns The resolved CLI configuration object
*/
export async function getConfig(): Promise<CLIConfig> {
    const cwd = process.cwd();
    const configFiles = ['pphatdev.json', 'components.json', 'config.json'];
    let config: CLIConfig = {
        name: 'Default configuration',
        icons: {
            svg: { dir: 'assets/icons', use: false },
            nextjs: { dir: 'components/icons', use: false },
            nuxtjs: { dir: 'components/icons', use: false }
        },
        components: {
            nextjs: { dir: 'components/ui', use: false },
            nuxtjs: { dir: 'components/ui', use: false }
        }
    };

    for (const configFile of configFiles) {
        const configPath = path.join(cwd, configFile);
        if (existsSync(configPath)) {
            try {
                const configContent = await fs.readFile(configPath, 'utf-8');
                const strippedContent = configContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
                const parsed = JSON.parse(strippedContent) as CLIConfig;
                config = { ...config, ...parsed };
                break;
            } catch (err) {
                console.warn(chalk.yellow(`Found ${configFile} but failed to parse it.`));
            }
        }
    }

    return config;
}
