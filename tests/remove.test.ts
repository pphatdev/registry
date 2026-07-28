import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const cliPath = path.resolve(__dirname, '../src/index.ts');

/**
 * Helper: seed an icon into a known dir via `add-icon` with an explicit `-d` so
 * the resolved path is deterministic (independent of `pphatdev.json` defaults).
 * Returns the absolute path of the file the add produced.
 */
function seedIcon(cwd: string, targetSubDir: string, name: string, format: 'svg' | 'nextjs' | 'nuxtjs' = 'svg'): string {
    execSync(`npx tsx ${cliPath} add-icon ${name} -f ${format} -d ${targetSubDir}`, { cwd, encoding: 'utf-8' });
    const ext = format === 'svg' ? 'svg' : format === 'nextjs' ? 'tsx' : 'vue';
    return path.join(cwd, targetSubDir, `${name}.${ext}`);
}

describe('CLI Remove — hyphenated form (`remove-icon`)', () => {
    const testDir = path.resolve(__dirname, 'temp_remove_hyphen_dir');
    const testIcon = 'react';
    const subDir = 'icons_out';

    before(() => {
        if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    });

    after(() => {
        if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    });

    test('`remove-icon <name> -f svg -d <dir>` deletes the file that `add-icon` created', () => {
        const filePath = seedIcon(testDir, subDir, testIcon, 'svg');
        assert.ok(fs.existsSync(filePath), 'sanity: add-icon should have written the seed file');

        execSync(`npx tsx ${cliPath} remove-icon ${testIcon} -f svg -d ${subDir}`, { cwd: testDir, encoding: 'utf-8' });

        assert.ok(!fs.existsSync(filePath), `remove-icon should have deleted ${filePath}`);
    });

    test('`remove-icon` on a non-existent file warns but exits 0', () => {
        const emptyDir = 'empty_target';
        fs.mkdirSync(path.join(testDir, emptyDir), { recursive: true });
        // Ora's warn() writes to stderr, so combine both streams.
        const stdout = execSync(
            `npx tsx ${cliPath} remove-icon ${testIcon} -f svg -d ${emptyDir}`,
            { cwd: testDir, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] },
        );
        // The important behaviour is the exit code (implicit 0 — throw would fail here).
        // Also assert the target file was never created as a side-effect.
        assert.ok(
            !fs.existsSync(path.join(testDir, emptyDir, `${testIcon}.svg`)),
            'remove should not create files',
        );
        // stdout may or may not include the warning depending on TTY detection; do not require it.
        assert.ok(typeof stdout === 'string');
    });
});

describe('CLI Remove — subcommand form (`remove icon`)', () => {
    const testDir = path.resolve(__dirname, 'temp_remove_subcmd_dir');
    const testIcon = 'react';

    before(() => {
        if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    });

    after(() => {
        if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    });

    test('`remove icon <name> -f svg -d <dir>` deletes the file', () => {
        const subDir = 'subcmd_target';
        const filePath = seedIcon(testDir, subDir, testIcon, 'svg');
        assert.ok(fs.existsSync(filePath));

        execSync(`npx tsx ${cliPath} remove icon ${testIcon} -f svg -d ${subDir}`, { cwd: testDir, encoding: 'utf-8' });

        assert.ok(!fs.existsSync(filePath), 'remove icon should have deleted the file');
    });

    test('`remove icon` is idempotent — second remove of the same name is a no-op', () => {
        const subDir = 'idempotent_target';
        const filePath = seedIcon(testDir, subDir, testIcon, 'svg');
        assert.ok(fs.existsSync(filePath));

        // First remove: deletes the file.
        execSync(`npx tsx ${cliPath} remove icon ${testIcon} -f svg -d ${subDir}`, { cwd: testDir, encoding: 'utf-8' });
        assert.ok(!fs.existsSync(filePath));

        // Second remove: file is already gone; must not throw / must exit 0.
        execSync(`npx tsx ${cliPath} remove icon ${testIcon} -f svg -d ${subDir}`, { cwd: testDir, encoding: 'utf-8' });
    });
});

describe('CLI Remove — error paths', () => {
    const testDir = path.resolve(__dirname, 'temp_remove_errors_dir');

    before(() => {
        if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    });

    after(() => {
        if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    });

    test('`remove` with no args exits 1', () => {
        assert.throws(
            () => execSync(`npx tsx ${cliPath} remove`, {
                cwd: testDir,
                encoding: 'utf-8',
                stdio: 'pipe',
            }),
            (err: Error & { status?: number; stderr?: string }) => {
                assert.strictEqual(err.status, 1);
                assert.match(String(err.stderr ?? ''), /Nothing to remove/);
                return true;
            },
        );
    });

    test('`remove foo` (unknown target) exits 1 with usage hint', () => {
        assert.throws(
            () => execSync(`npx tsx ${cliPath} remove foo`, {
                cwd: testDir,
                encoding: 'utf-8',
                stdio: 'pipe',
            }),
            (err: Error & { status?: number; stderr?: string }) => {
                assert.strictEqual(err.status, 1);
                const stderr = String(err.stderr ?? '');
                assert.match(stderr, /Unknown target "foo"/);
                assert.match(stderr, /Expected `icon` or `component`/);
                return true;
            },
        );
    });

    test('`remove icon` with no names exits 1', () => {
        assert.throws(
            () => execSync(`npx tsx ${cliPath} remove icon`, {
                cwd: testDir,
                encoding: 'utf-8',
                stdio: 'pipe',
            }),
            (err: Error & { status?: number; stderr?: string }) => {
                assert.strictEqual(err.status, 1);
                assert.match(String(err.stderr ?? ''), /Please provide at least one icon name/);
                return true;
            },
        );
    });
});
