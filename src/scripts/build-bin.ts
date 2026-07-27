import fs from 'fs/promises';
import path from 'path';

interface PackageJson {
    bin?: Record<string, string>;
}

const ROOT = path.join(__dirname, '../..');
const PKG_PATH = path.join(ROOT, 'package.json');

function shim(alias: string, binName: string): string {
    const isScoped = binName.startsWith('@');
    if (!isScoped) {
        return `#!/usr/bin/env node
process.env.PPHAT_INVOKED_AS = '${alias}';
require('../dist/index.js');
`;
    }
    return `#!/usr/bin/env node
process.env.PPHAT_INVOKED_AS = '${alias}';

// Workaround: on Windows, npm's shim for the scoped bin \`${binName}\`
// can inject a spurious "/${alias}" as the first user argument.
if (process.argv[2] === '/${alias}') {
  process.argv.splice(2, 1);
}

require('../dist/index.js');
`;
}

async function main() {
    const raw = await fs.readFile(PKG_PATH, 'utf-8');
    const pkg = JSON.parse(raw) as PackageJson;
    const bins = pkg.bin ?? {};

    const entries = Object.entries(bins);
    if (entries.length === 0) {
        console.error('No "bin" entries in package.json. Nothing to build.');
        process.exit(1);
    }

    for (const [binName, filePath] of entries) {
        const alias = binName.startsWith('@') ? binName.split('/').pop()! : binName;
        const outPath = path.join(ROOT, filePath);
        await fs.mkdir(path.dirname(outPath), { recursive: true });
        await fs.writeFile(outPath, shim(alias, binName), 'utf-8');
        console.log(`wrote ${filePath.replace(/\\/g, '/')}  (alias=${alias}${binName.startsWith('@') ? ', scoped' : ''})`);
    }

    console.log(`Built ${entries.length} bin shim${entries.length === 1 ? '' : 's'}.`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
