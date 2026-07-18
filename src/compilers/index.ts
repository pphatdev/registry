export function toPascalCase(str: string): string {
    return str.replace(/(^\w|-\w)/g, (clearAndUpper) => clearAndUpper.replace(/-/, '').toUpperCase());
}

export function formatSvgParts(content: string, baseIndent: number, tabSize: number, isReact: boolean): { attributes: string, rawAttributes: string, inner: string } | null {
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
