import { test, describe } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import path from 'node:path';

describe('CLI Help Commands (-h / --help)', () => {
    const cliPath = path.resolve(__dirname, '../src/index.ts');

    test('Root CLI help', () => {
        const output = execSync(`npx tsx ${cliPath} --help`, { encoding: 'utf-8' });
        assert.match(output, /A powerful and extremely fast CLI tool/);
        assert.match(output, /Examples:/);
        assert.match(output, /pphat init/);
        // New parent commands should appear in the root help listing.
        assert.match(output, /^\s+add\s+\[options\]/m, 'root help should list `add` parent command');
        assert.match(output, /^\s+remove\s+\[options\]/m, 'root help should list `remove` parent command');
    });

    test('`add` parent help', () => {
        const output = execSync(`npx tsx ${cliPath} add -h`, { encoding: 'utf-8' });
        assert.match(output, /Add icons or components/);
        assert.match(output, /-f, --format <format>/);
        assert.match(output, /-d, --dir <dir>/);
        assert.match(output, /pphat add icon /);
        assert.match(output, /pphat add component /);
        assert.match(output, /Examples:/);
    });

    test('`add-icon` hyphenated help', () => {
        const output = execSync(`npx tsx ${cliPath} add-icon -h`, { encoding: 'utf-8' });
        assert.match(output, /Download and copy icons/);
        assert.match(output, /-f, --format <format>/);
        assert.match(output, /Examples:/);
    });

    test('`add-component` hyphenated help', () => {
        const output = execSync(`npx tsx ${cliPath} add-component -h`, { encoding: 'utf-8' });
        assert.match(output, /Download and copy components/);
        assert.match(output, /-f, --format <format>/);
        assert.match(output, /Examples:/);
    });

    test('`remove` parent help', () => {
        const output = execSync(`npx tsx ${cliPath} remove -h`, { encoding: 'utf-8' });
        assert.match(output, /Remove previously downloaded icons or components/);
        assert.match(output, /-f, --format <format>/);
        assert.match(output, /-d, --dir <dir>/);
        assert.match(output, /pphat remove icon /);
        assert.match(output, /pphat remove component /);
        assert.match(output, /Examples:/);
    });

    test('`remove-icon` hyphenated help', () => {
        const output = execSync(`npx tsx ${cliPath} remove-icon -h`, { encoding: 'utf-8' });
        assert.match(output, /Remove previously downloaded icons/);
        assert.match(output, /-f, --format <format>/);
        assert.match(output, /Examples:/);
    });

    test('`remove-component` hyphenated help', () => {
        const output = execSync(`npx tsx ${cliPath} remove-component -h`, { encoding: 'utf-8' });
        assert.match(output, /Remove previously downloaded components/);
        assert.match(output, /-f, --format <format>/);
        assert.match(output, /Examples:/);
    });

    test('Init command help', () => {
        const output = execSync(`npx tsx ${cliPath} init -h`, { encoding: 'utf-8' });
        assert.match(output, /Initialize configuration \(pphatdev\.json\)/);
        assert.match(output, /Examples:/);
    });

    test('List command help', () => {
        const output = execSync(`npx tsx ${cliPath} list -h`, { encoding: 'utf-8' });
        assert.match(output, /List all available items in the registry/);
        assert.match(output, /Type of packages to list/);
        assert.match(output, /Examples:/);
    });

    test('Config command help', () => {
        const output = execSync(`npx tsx ${cliPath} config -h`, { encoding: 'utf-8' });
        assert.match(output, /View or update configuration/);
        assert.match(output, /Examples:/);
    });
});
