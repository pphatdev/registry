import { test, describe, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Tests the interactive `init` command by mocking `@inquirer/prompts`.
 * Requires: node --experimental-test-module-mocks.
 */

// Mutable answer state — configured per test, consumed by the mock.
type Answers = {
    name: string;
    useType: 'icons' | 'components' | 'both';
    iconFormats: string[];
    componentFormats: string[];
    iconDirs: Record<string, string>;
    componentDirs: Record<string, string>;
};

let currentAnswers: Answers;
let inputQueue: string[] = [];
let inputIdx = 0;
let checkboxQueue: string[][] = [];
let checkboxIdx = 0;

// Mock at module scope, before any test imports the init command.
mock.module('@inquirer/prompts', {
    namedExports: {
        input: async () => inputQueue[inputIdx++],
        select: async () => currentAnswers.useType,
        checkbox: async () => checkboxQueue[checkboxIdx++],
        confirm: async () => true,
    },
});

function setAnswers(a: Partial<Answers> & Pick<Answers, 'useType'>) {
    currentAnswers = {
        name: a.name ?? 'Default configuration',
        useType: a.useType,
        iconFormats: a.iconFormats ?? [],
        componentFormats: a.componentFormats ?? [],
        iconDirs: a.iconDirs ?? {},
        componentDirs: a.componentDirs ?? {},
    };
    // Prompt call order: name → (select) → (checkbox[es]) → per-selected-format dir inputs
    inputQueue = [currentAnswers.name];
    if (currentAnswers.iconFormats.includes('svg')) inputQueue.push(currentAnswers.iconDirs.svg ?? 'assets/icons');
    if (currentAnswers.iconFormats.includes('nextjs')) inputQueue.push(currentAnswers.iconDirs.nextjs ?? 'components/icons');
    if (currentAnswers.iconFormats.includes('nuxtjs')) inputQueue.push(currentAnswers.iconDirs.nuxtjs ?? 'components/icons');
    if (currentAnswers.componentFormats.includes('nextjs')) inputQueue.push(currentAnswers.componentDirs.nextjs ?? 'components/ui');
    if (currentAnswers.componentFormats.includes('nuxtjs')) inputQueue.push(currentAnswers.componentDirs.nuxtjs ?? 'components/ui');
    inputIdx = 0;

    checkboxQueue = [];
    if (currentAnswers.useType === 'icons' || currentAnswers.useType === 'both') {
        checkboxQueue.push(currentAnswers.iconFormats);
    }
    if (currentAnswers.useType === 'components' || currentAnswers.useType === 'both') {
        checkboxQueue.push(currentAnswers.componentFormats);
    }
    checkboxIdx = 0;
}

describe('CLI Init Command', () => {
    const testDir = path.resolve(__dirname, 'temp_init_dir');
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

    async function runInit() {
        const mod = await import('../src/cli/commands/init');
        await mod.initCommand.parseAsync(['node', 'init'], { from: 'user' });
    }

    test('Icons only + SVG selected → unselected icon formats get use:false, no components section', async () => {
        setAnswers({ useType: 'icons', iconFormats: ['svg'] });
        await runInit();

        assert.ok(fs.existsSync(configPath), 'pphatdev.json should be created');
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

        assert.strictEqual(cfg.name, 'Default configuration');
        assert.deepStrictEqual(cfg.icons.svg, { dir: 'assets/icons', use: true });
        assert.deepStrictEqual(cfg.icons.nextjs, { dir: 'components/icons', use: false });
        assert.deepStrictEqual(cfg.icons.nuxtjs, { dir: 'components/icons', use: false });
        assert.deepStrictEqual(cfg.components.nextjs, { dir: 'components/ui', use: false });
        assert.deepStrictEqual(cfg.components.nuxtjs, { dir: 'components/ui', use: false });
    });

    test('Components only + Nextjs selected → nuxtjs component gets use:false, icons section present with use:false', async () => {
        setAnswers({ useType: 'components', componentFormats: ['nextjs'] });
        await runInit();

        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        assert.deepStrictEqual(cfg.icons.nextjs, { dir: 'components/icons', use: false });
        assert.deepStrictEqual(cfg.components.nextjs, { dir: 'components/ui', use: true });
        assert.deepStrictEqual(cfg.components.nuxtjs, { dir: 'components/ui', use: false });
    });

    test('Both + all formats selected → every entry has use:true', async () => {
        setAnswers({
            useType: 'both',
            iconFormats: ['svg', 'nextjs', 'nuxtjs'],
            componentFormats: ['nextjs', 'nuxtjs'],
        });
        await runInit();

        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        assert.strictEqual(cfg.icons.svg.use, true);
        assert.strictEqual(cfg.icons.nextjs.use, true);
        assert.strictEqual(cfg.icons.nuxtjs.use, true);
        assert.strictEqual(cfg.components.nextjs.use, true);
        assert.strictEqual(cfg.components.nuxtjs.use, true);
    });
});
