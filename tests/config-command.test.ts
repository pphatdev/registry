import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';

describe('CLI Config Command', () => {
    const testDir = path.resolve(__dirname, 'temp_config_cmd_dir');
    const configPath = path.join(testDir, 'pphatdev.json');
    const originalCwd = process.cwd;

    before(() => {
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
        process.cwd = () => testDir;
    });

    after(() => {
        process.cwd = originalCwd;
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    beforeEach(() => {
        if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
        }
    });

    test('config set updates existing pphatdev.json properties', async () => {
        const initialConfig = {
            name: "Initial Config",
            icons: {
                nextjs: { dir: "components/icons", use: false }
            }
        };
        fs.writeFileSync(configPath, JSON.stringify(initialConfig, null, 2));

        const { configCommand } = await import('../src/cli/commands/config');
        await configCommand.parseAsync(['node', 'config', 'set', 'icons.nextjs.use', 'true'], { from: 'user' });

        const updated = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        assert.strictEqual(updated.icons.nextjs.use, true);
    });

    test('config set creates nested keys if missing', async () => {
        const initialConfig = { name: "Test Config" };
        fs.writeFileSync(configPath, JSON.stringify(initialConfig, null, 2));

        const { configCommand } = await import('../src/cli/commands/config');
        await configCommand.parseAsync(['node', 'config', 'set', 'icons.svg.dir', 'custom/svg'], { from: 'user' });

        const updated = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        assert.strictEqual(updated.icons.svg.dir, 'custom/svg');
    });
});
