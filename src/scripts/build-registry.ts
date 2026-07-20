import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

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

/**
 * Constants
*/
const TARGET_DIRS = ['icons', 'brands'];
const REGISTRY_DIR = path.join(__dirname, '../../registry');


/**
* Ensure Directories
* @description Ensures that all required registry target directories exist, creating them if necessary
* @returns void
*/
function ensureDirectories() {
    if (!existsSync(REGISTRY_DIR)) mkdirSync(REGISTRY_DIR, { recursive: true });
    for (const dir of TARGET_DIRS) {
        const baseFolder = dir;
        const typeDir = path.join(REGISTRY_DIR, baseFolder);
        if (!existsSync(typeDir)) mkdirSync(typeDir, { recursive: true });
    }
}

/**
* Transform SVG to React Component
* @description Converts a raw SVG string into a standard React (TSX) component string
* @param name The original file name (used to generate the component name)
* @param svgString The raw SVG content
* @returns The React component source code string
*/
function transformSvgToReactComponent(name: string, svgString: string): string {
    // Convert kebab-case or snake_case to PascalCase for component name
    const componentName = name.split(/[-_]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('') + 'Icon';
    
    const svgMatch = svgString.match(/<svg([^>]*)>([\s\S]*?)<\/svg>/i);
    if (!svgMatch) return svgString;

    const attrString = svgMatch[1].trim();
    // Parse attributes preserving spaces inside quotes
    const attrsMatch = attrString.match(/[^\s="']+=(?:"[^"]*"|'[^']*')|[^\s="']+/g) || [];
    const formattedAttributes = attrsMatch.map(attr => `        ${attr}`).join('\n');

    let innerContent = svgMatch[2];

    // Wrap <style> contents in template literals for JSX compatibility
    innerContent = innerContent.replace(/<style>([\s\S]*?)<\/style>/gi, '<style>{`$1`}</style>');
    
    // Ensure inner content is nicely indented by 8 spaces
    // Remove leading/trailing newlines
    innerContent = innerContent.replace(/^\s+|\s+$/g, '');
    // Only prefix lines that have content
    innerContent = innerContent.split('\n').map(line => line.trim() ? `        ${line.trimLeft()}` : '').join('\n');

    return `import React, { forwardRef } from 'react';

export const ${componentName} = forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>((props, ref) => (
    <svg
        ref={ref}
${formattedAttributes}
        {...props}
    >
${innerContent}
    </svg>
));

${componentName}.displayName = '${componentName}';
`;
}


/**
* Build Registry
* @description Fetches items from the GitHub repository, processes them, and writes the local registry JSON files
* @returns Promise resolving when the build completes
*/
const buildRegistry = async () => {
    try {
        ensureDirectories();
        const categories: { name: string; target: string }[] = [];
        let processedCount = 0;

        for (const dir of TARGET_DIRS) {
            console.log(`Fetching list from GitHub directory: ${dir}...`);
            const apiUrl = `https://api.github.com/repos/pphatdev/icons/contents/${dir}`;

            const headers: Record<string, string> = { 'User-Agent': 'pphatdev-cli' };
            if (process.env.GITHUB_TOKEN) {
                headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
            }

            const response = await fetch(apiUrl, { headers });

            if (!response.ok) {
                const text = await response.text();
                console.warn(`Skipping ${dir}: HTTP ${response.status} ${response.statusText} - ${text}`);
                continue;
            }

            const files = await response.json();
            if (!Array.isArray(files)) continue;

            const categoryItems: (RegistryIndexItem & { type: string })[] = [];

            for (const file of files) {
                const ext = path.extname(file.name);
                if (!['.svg', '.tsx', '.vue', '.ts', '.js', '.json'].includes(ext)) continue;

                const name = file.name.replace(ext, '');
                console.log(`Downloading ${dir}/${file.name}...`);
                const rawResponse = await fetch(file.download_url);
                const content = await rawResponse.text();

                let item: RegistryItem;
                if (ext === '.json') {
                    if (file.name === 'index.json' || file.name === 'schema.json') continue;
                    try {
                        item = JSON.parse(content);
                    } catch (e) {
                        console.warn(`Failed to parse ${file.name}`);
                        continue;
                    }
                } else {
                    const filesArr: RegistryItemFile[] = [{ path: file.name, content }];
                    if (ext === '.svg' && dir !== 'components') {
                         filesArr.push({ path: `${name}.tsx`, content: transformSvgToReactComponent(name, content) });
                    }
                    item = {
                        name,
                        files: filesArr
                    };
                }

                const baseFolder = dir === 'components' ? 'components' : `icons/${dir}`;

                // Ensure baseFolder directory exists
                const typeDir = path.join(REGISTRY_DIR, baseFolder);
                if (!existsSync(typeDir)) await fs.mkdir(typeDir, { recursive: true });

                // Write individual JSON file into its type folder
                await fs.writeFile(
                    path.join(REGISTRY_DIR, baseFolder, `${name}.json`),
                    JSON.stringify(item, null, 2)
                );

                // Add to category items list
                categoryItems.push({ name, type: dir, target: `${baseFolder}/${name}.json` });
                processedCount++;
            }

            if (categoryItems.length > 0) {
                const categoryFolder = dir === 'components' ? 'components' : 'icons';
                if (!existsSync(path.join(REGISTRY_DIR, categoryFolder))) {
                    await fs.mkdir(path.join(REGISTRY_DIR, categoryFolder), { recursive: true });
                }
                
                await fs.writeFile(
                    path.join(REGISTRY_DIR, categoryFolder, `${dir}.json`),
                    JSON.stringify(categoryItems, null, 2)
                );
                categories.push({ name: dir, target: `${categoryFolder}/${dir}.json` });
            }
        }

        // Write index.json
        await fs.writeFile(
            path.join(REGISTRY_DIR, 'index.json'),
            JSON.stringify(categories, null, 2)
        );

        console.log(`Successfully built registry with ${processedCount} icons at /registry.`);
    } catch (error) {
        console.error('Failed to build registry:', error);
        process.exit(1);
    }
};

buildRegistry();
