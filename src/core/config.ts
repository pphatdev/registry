import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import chalk from 'chalk';

export interface CLIConfig {
    use?: {
        nextjs?: boolean;
        nuxtjs?: boolean;
        svg?: boolean;
    };
    nextjs?: { iconsDir?: string; componentsDir?: string };
    nuxtjs?: { iconsDir?: string; componentsDir?: string };
    svg?: { iconsDir?: string; svgDir?: string };
}

export async function getConfig(): Promise<CLIConfig> {
    const cwd = process.cwd();
    const configFiles = ['pphatdev.json', 'components.json'];
    let config: CLIConfig = {
        use: { svg: true },
        svg: { iconsDir: 'icons' }
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
