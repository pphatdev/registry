import { test, describe } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import path from 'node:path';

describe('CLI Help Commands (-h)', () => {
    const cliPath = path.resolve(__dirname, '../src/index.ts');
    test('Add command help', () => {
        const output = execSync(`npx tsx ${cliPath} add -h`, { encoding: 'utf-8' });
        assert.match(output, /Download and copy an item/);
        assert.match(output, /-f, --format <format>/);
        assert.match(output, /Override format to download/);
    });

    test('Init command help', () => {
        const output = execSync(`npx tsx ${cliPath} init -h`, { encoding: 'utf-8' });
        assert.match(output, /Initialize configuration \(pphatdev\.json\)/);
    });

    test('List command help', () => {
        const output = execSync(`npx tsx ${cliPath} list -h`, { encoding: 'utf-8' });
        assert.match(output, /List all available items in the registry/);
        assert.match(output, /Type of packages to list/);
    });
});
