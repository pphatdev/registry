/**
* Convert to Pascal Case
* @description Converts a given string (e.g., kebab-case) to PascalCase
* @param str The string to convert
* @returns The PascalCase string
*/
export function toPascalCase(str: string): string {
    return str.replace(/(^\w|-\w)/g, (clearAndUpper) => clearAndUpper.replace(/-/, '').toUpperCase());
}

/**
/**
* Format CSS Inside Style Tag
* @description Formats CSS rule sets into clean single-line declarations for SVG style blocks
*/
export function formatCssInsideStyle(cssContent: string): string[] {
    const clean = cssContent.replace(/\s+/g, ' ').trim();
    if (!clean) return [];

    const rules: string[] = [];
    let depth = 0;
    let currentRule = '';

    for (let i = 0; i < clean.length; i++) {
        const char = clean[i];
        currentRule += char;
        if (char === '{') {
            depth++;
        } else if (char === '}') {
            depth--;
            if (depth === 0) {
                let ruleStr = currentRule.trim()
                    .replace(/\s*{\s*/g, ' { ')
                    .replace(/\s*}\s*/g, '} ')
                    .replace(/\s*;\s*/g, '; ')
                    .replace(/\s*:\s*/g, ': ')
                    .replace(/\s+/g, ' ')
                    .trim();
                ruleStr = ruleStr.replace(/;\s*}/g, ';}').replace(/{\s+/g, '{ ').replace(/\s+}/g, ' }');
                rules.push(ruleStr);
                currentRule = '';
            }
        }
    }
    if (currentRule.trim()) {
        rules.push(currentRule.trim());
    }
    return rules;
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
export function formatSvgParts(content: string, baseIndent: number, tabSize: number, isReact: boolean): { attributes: string, rawAttributes: string, inner: string } | null {
    const svgMatch = content.match(/<svg([^>]*)>([\s\S]*?)<\/svg>/i);
    if (!svgMatch) return null;

    const attrIndent = baseIndent + tabSize;
    const attrString = svgMatch[1].trim();
    const attrsMatch = attrString.match(/[^\s="']+=(?:"[^"]*"|'[^']*')|[^\s="']+/g) || [];
    const formattedAttributes = attrsMatch.map(attr => ' '.repeat(attrIndent) + attr).join('\n');

    let innerContent = svgMatch[2].trim();

    // Pre-format <style> blocks before splitting HTML tags
    const styleBlocks: string[] = [];
    innerContent = innerContent.replace(/<style>([\s\S]*?)<\/style>/gi, (_, css) => {
        const rules = formatCssInsideStyle(css);
        const index = styleBlocks.length;
        const formattedCss = rules.map(r => ' '.repeat(attrIndent + tabSize) + r).join('\n');
        if (isReact) {
            styleBlocks.push(' '.repeat(attrIndent) + '<style>{`\n' + formattedCss + '\n' + ' '.repeat(attrIndent) + '`}</style>');
        } else {
            styleBlocks.push(' '.repeat(attrIndent) + '<style>\n' + formattedCss + '\n' + ' '.repeat(attrIndent) + '</style>');
        }
        return `__STYLE_BLOCK_${index}__`;
    });

    innerContent = innerContent.replace(/(>)\s*(<)/g, '$1\n$2');

    const lines = innerContent.split('\n');
    const formattedInner: string[] = [];
    let currentIndent = attrIndent;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('__STYLE_BLOCK_') && trimmed.endsWith('__')) {
            const index = parseInt(trimmed.replace('__STYLE_BLOCK_', '').replace('__', ''), 10);
            if (styleBlocks[index] !== undefined) {
                formattedInner.push(styleBlocks[index]);
            }
        } else if (trimmed.startsWith('</')) {
            currentIndent = Math.max(attrIndent, currentIndent - tabSize);
            formattedInner.push(' '.repeat(currentIndent) + trimmed);
        } else if (trimmed.startsWith('<') && !trimmed.startsWith('</')) {
            formattedInner.push(' '.repeat(currentIndent) + trimmed);
            if (!trimmed.endsWith('/>') && !trimmed.includes('</')) {
                currentIndent += tabSize;
            }
        } else {
            formattedInner.push(' '.repeat(currentIndent) + trimmed);
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
export function transformContent(name: string, content: string, format: string): { path: string, content: string } {
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
