import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

describe('CLI Add Command (-f formats)', () => {
    const cliPath = path.resolve(__dirname, '../src/index.ts');
    
    // We will test using an icon that we know exists in the registry, e.g., "react"
    const testIcon = 'react'; 
    
    // We run the CLI inside a temp directory to avoid polluting the workspace
    const testDir = path.resolve(__dirname, 'temp_test_dir');
    const defaultIconsDir = path.join(testDir, 'icons');

    before(() => {
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
    });

    after(() => {
        // Clean up the temp directory after tests
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    test('Download as SVG', () => {
        // Run add command with svg format
        execSync(`npx tsx ${cliPath} add-icon ${testIcon} -f svg`, { cwd: testDir, encoding: 'utf-8' });
        
        // The default config in getConfig() sets 'assets/icons' for svg
        const expectedFilePath = path.join(testDir, 'assets', 'icons', `${testIcon}.svg`);
        assert.ok(fs.existsSync(expectedFilePath), `File should exist at ${expectedFilePath}`);
        
        // Verify the content is an SVG
        const content = fs.readFileSync(expectedFilePath, 'utf-8');
        assert.match(content, /<svg/i, 'File should contain an <svg> tag');
    });

    test('Download as Next.js (TSX)', () => {
        execSync(`npx tsx ${cliPath} add-icon ${testIcon} -f nextjs`, { cwd: testDir, encoding: 'utf-8' });
        
        // The default config in getConfig() sets 'src/components/icons' for nextjs icons
        let expectedFilePath = path.join(testDir, 'components', 'icons', `${testIcon}.tsx`);
        if (!fs.existsSync(expectedFilePath)) {
            expectedFilePath = path.join(testDir, 'components', 'icons', 'ReactIcon.tsx');
        }
        
        assert.ok(fs.existsSync(expectedFilePath), `File should exist at ${expectedFilePath}`);
        
        // Verify the content is a React component
        const content = fs.readFileSync(expectedFilePath, 'utf-8');
        assert.match(content, /import React/);
        assert.match(content, /<svg/i);
    });

    test('Download as Nuxt.js (Vue)', () => {
        execSync(`npx tsx ${cliPath} add-icon ${testIcon} -f nuxtjs`, { cwd: testDir, encoding: 'utf-8' });
        
        // The default config in getConfig() sets 'src/components/icons' for nuxtjs icons
        const expectedFilePath = path.join(testDir, 'components', 'icons', `${testIcon}.vue`);
        assert.ok(fs.existsSync(expectedFilePath), `File should exist at ${expectedFilePath}`);
        
        // Verify the content is a Vue component
        const content = fs.readFileSync(expectedFilePath, 'utf-8');
        assert.match(content, /<template>/);
        assert.match(content, /<svg/i);
    });
});

describe('CLI Add Command (with pphatdev.json config)', () => {
    const cliPath = path.resolve(__dirname, '../src/index.ts');
    const testIcon = 'react'; 
    const testDir = path.resolve(__dirname, 'temp_config_test_dir');
    const configPath = path.join(testDir, 'pphatdev.json');

    before(() => {
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
        
        // Create a mock config file to test custom paths
        const mockConfig = {
            name: "Test configuration",
            icons: {
                svg: { dir: "custom_assets/icons", use: true },
                nextjs: { dir: "custom_components/icons", use: true },
                nuxtjs: { dir: "custom_components/icons_vue", use: true }
            }
        };
        fs.writeFileSync(configPath, JSON.stringify(mockConfig, null, 2));
    });

    after(() => {
        // Clean up
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    test('Verify configured downloaded path (SVG)', () => {
        execSync(`npx tsx ${cliPath} add-icon ${testIcon} -f svg`, { cwd: testDir, encoding: 'utf-8' });
        
        // It should save into custom_assets/icons as per config
        const expectedFilePath = path.join(testDir, 'custom_assets', 'icons', `${testIcon}.svg`);
        assert.ok(fs.existsSync(expectedFilePath), `File should exist at configured path ${expectedFilePath}`);
    });

    test('Verify configured downloaded path (Next.js)', () => {
        execSync(`npx tsx ${cliPath} add-icon ${testIcon} -f nextjs`, { cwd: testDir, encoding: 'utf-8' });
        
        // It should save into custom_components/icons as per config
        let expectedFilePath = path.join(testDir, 'custom_components', 'icons', `${testIcon}.tsx`);
        if (!fs.existsSync(expectedFilePath)) {
            expectedFilePath = path.join(testDir, 'custom_components', 'icons', 'ReactIcon.tsx');
        }
        
        assert.ok(fs.existsSync(expectedFilePath), `File should exist at configured path ${expectedFilePath}`);
    });

    test('Verify configured downloaded path (Nuxt.js)', () => {
        execSync(`npx tsx ${cliPath} add-icon ${testIcon} -f nuxtjs`, { cwd: testDir, encoding: 'utf-8' });
        
        // It should save into custom_components/icons_vue as per config
        const expectedFilePath = path.join(testDir, 'custom_components', 'icons_vue', `${testIcon}.vue`);
        assert.ok(fs.existsSync(expectedFilePath), `File should exist at configured path ${expectedFilePath}`);
    });
});
