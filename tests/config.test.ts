import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { getConfig } from '../src/core/config';

describe('Config parsing (getConfig)', () => {
    // getConfig() uses process.cwd(), so we mock it during this test suite
    const originalCwd = process.cwd;
    const testDir = path.resolve(__dirname, 'temp_config_parser_dir');

    before(() => {
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
        // Mock process.cwd to return our temp test directory
        process.cwd = () => testDir;
    });

    after(() => {
        // Restore process.cwd
        process.cwd = originalCwd;
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    test('should return default config if no file exists', async () => {
        const config = await getConfig();
        assert.strictEqual(config.name, 'Default configuration');
        assert.strictEqual(config.icons?.svg?.dir, 'assets/icons');
        assert.strictEqual(config.components?.nextjs?.dir, 'components/ui');
    });

    test('should parse and merge pphatdev.json correctly', async () => {
        const configPath = path.join(testDir, 'pphatdev.json');
        const mockConfig = {
            name: "My Custom Config",
            icons: {
                svg: { dir: "my_svg_dir", use: true }
            }
        };
        fs.writeFileSync(configPath, JSON.stringify(mockConfig));

        const config = await getConfig();
        assert.strictEqual(config.name, "My Custom Config");
        
        // Merged values
        assert.strictEqual(config.icons?.svg?.dir, "my_svg_dir");
        assert.strictEqual(config.icons?.svg?.use, true);
        
        // Ensure defaults are still present for missing fields
        assert.strictEqual(config.components?.nextjs?.dir, 'components/ui');

        fs.unlinkSync(configPath);
    });

    test('should strip comments from JSON file before parsing', async () => {
        const configPath = path.join(testDir, 'pphatdev.json');
        const mockContentWithComments = `
        {
            // This is a line comment
            "name": "Commented Config",
            /* This is a block comment */
            "icons": {
                "nextjs": { "dir": "some_dir", "use": true }
            }
        }
        `;
        fs.writeFileSync(configPath, mockContentWithComments);

        const config = await getConfig();
        assert.strictEqual(config.name, "Commented Config");
        assert.strictEqual(config.icons?.nextjs?.dir, "some_dir");
        assert.strictEqual(config.icons?.nextjs?.use, true);

        fs.unlinkSync(configPath);
    });
});
