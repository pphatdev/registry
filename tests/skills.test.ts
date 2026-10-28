import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

describe('CLI Skills Management (add, update, remove, list)', () => {
    const cliPath = path.resolve(__dirname, '../src/index.ts');
    const testDir = path.resolve(__dirname, 'temp_skills_test_dir');
    const mockRepoDir = path.resolve(__dirname, 'mock_skills_repo');
    const mockMultiRepoDir = path.resolve(__dirname, 'mock_multi_skills_repo');

    before(() => {
        if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

        // 1. Setup mock single-skill repo with root SKILL.md
        if (!fs.existsSync(mockRepoDir)) fs.mkdirSync(mockRepoDir, { recursive: true });
        fs.writeFileSync(
            path.join(mockRepoDir, 'SKILL.md'),
            `---\nname: my-sample-skill\ndescription: Test single skill description\n---\n# My Sample Skill\nInstructions here.`
        );
        fs.writeFileSync(path.join(mockRepoDir, 'helper.js'), 'console.log("skill helper");');

        // 2. Setup mock multi-skill repo with skills/ subfolder
        if (!fs.existsSync(mockMultiRepoDir)) fs.mkdirSync(mockMultiRepoDir, { recursive: true });
        const skill1Dir = path.join(mockMultiRepoDir, 'skills', 'skill-one');
        const skill2Dir = path.join(mockMultiRepoDir, 'skills', 'skill-two');
        fs.mkdirSync(skill1Dir, { recursive: true });
        fs.mkdirSync(skill2Dir, { recursive: true });

        fs.writeFileSync(
            path.join(skill1Dir, 'SKILL.md'),
            `---\nname: skill-one\ndescription: First modular skill\n---\n# Skill One\n`
        );
        fs.writeFileSync(
            path.join(skill2Dir, 'SKILL.md'),
            `---\nname: skill-two\ndescription: Second modular skill\n---\n# Skill Two\n`
        );
    });

    after(() => {
        if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
        if (fs.existsSync(mockRepoDir)) fs.rmSync(mockRepoDir, { recursive: true, force: true });
        if (fs.existsSync(mockMultiRepoDir)) fs.rmSync(mockMultiRepoDir, { recursive: true, force: true });
    });

    beforeEach(() => {
        // Clean out testDir contents between tests
        const files = fs.readdirSync(testDir);
        for (const file of files) {
            fs.rmSync(path.join(testDir, file), { recursive: true, force: true });
        }
    });

    test('`pphat add skill <source>` installs single-skill repo into default target dir (.agent/skills)', () => {
        execSync(`npx tsx ${cliPath} add skill ${mockRepoDir}`, { cwd: testDir, encoding: 'utf-8' });

        const installedSkillPath = path.join(testDir, '.agent', 'skills', 'my-sample-skill');
        assert.ok(fs.existsSync(installedSkillPath), `Skill should exist at ${installedSkillPath}`);
        assert.ok(fs.existsSync(path.join(installedSkillPath, 'SKILL.md')), 'SKILL.md should exist');
        assert.ok(fs.existsSync(path.join(installedSkillPath, 'helper.js')), 'helper.js should exist');

        // Verify .skills.json manifest was created
        const manifestPath = path.join(testDir, '.skills.json');
        assert.ok(fs.existsSync(manifestPath), '.skills.json manifest should be created');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        assert.ok(manifest.skills[mockRepoDir], 'Manifest should contain installed entry');
        assert.strictEqual(manifest.skills[mockRepoDir].skills[0].name, 'my-sample-skill');

        // Verify skills-lock.json was created
        const lockPath = path.join(testDir, 'skills-lock.json');
        assert.ok(fs.existsSync(lockPath), 'skills-lock.json should be created');
        const lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
        assert.strictEqual(lock.version, 1);
        assert.ok(lock.skills['my-sample-skill'], 'Lock should track installed skill');
        assert.strictEqual(lock.skills['my-sample-skill'].sourceType, 'local');
        assert.ok(lock.skills['my-sample-skill'].computedHash, 'Lock should have computedHash');
    });

    test('`pphat add skill <source> -d <customDir>` installs into custom directory', () => {
        const customDir = 'custom/my-skills';
        execSync(`npx tsx ${cliPath} add skill ${mockRepoDir} -d ${customDir}`, { cwd: testDir, encoding: 'utf-8' });

        const installedSkillPath = path.join(testDir, customDir, 'my-sample-skill');
        assert.ok(fs.existsSync(installedSkillPath), `Skill should exist at custom path ${installedSkillPath}`);
    });

    test('`pphat add skill <source>` installs multi-skill repository with all skills inside skills/', () => {
        execSync(`npx tsx ${cliPath} add skill ${mockMultiRepoDir}`, { cwd: testDir, encoding: 'utf-8' });

        const skill1Path = path.join(testDir, '.agent', 'skills', 'skill-one');
        const skill2Path = path.join(testDir, '.agent', 'skills', 'skill-two');
        assert.ok(fs.existsSync(skill1Path), 'Skill one should be installed');
        assert.ok(fs.existsSync(skill2Path), 'Skill two should be installed');

        const manifest = JSON.parse(fs.readFileSync(path.join(testDir, '.skills.json'), 'utf-8'));
        const entry = manifest.skills[mockMultiRepoDir];
        assert.ok(entry, 'Manifest should have entry for multi-skill repo');
        assert.strictEqual(entry.skills.length, 2);
    });

    test('`pphat add skill <source1> <source2>` installs multiple sources in a single command', () => {
        execSync(`npx tsx ${cliPath} add skill ${mockRepoDir} ${mockMultiRepoDir}`, { cwd: testDir, encoding: 'utf-8' });

        assert.ok(fs.existsSync(path.join(testDir, '.agent', 'skills', 'my-sample-skill')));
        assert.ok(fs.existsSync(path.join(testDir, '.agent', 'skills', 'skill-one')));
        assert.ok(fs.existsSync(path.join(testDir, '.agent', 'skills', 'skill-two')));
    });

    test('`pphat update skill <source>` updates installed skill content', () => {
        // First install
        execSync(`npx tsx ${cliPath} add skill ${mockRepoDir}`, { cwd: testDir, encoding: 'utf-8' });

        const helperFile = path.join(testDir, '.agent', 'skills', 'my-sample-skill', 'helper.js');
        assert.ok(fs.existsSync(helperFile));

        // Modify source repo
        fs.writeFileSync(path.join(mockRepoDir, 'helper.js'), 'console.log("UPDATED helper");');
        fs.writeFileSync(path.join(mockRepoDir, 'newfile.txt'), 'brand new file');

        // Run update
        execSync(`npx tsx ${cliPath} update skill ${mockRepoDir}`, { cwd: testDir, encoding: 'utf-8' });

        const updatedContent = fs.readFileSync(helperFile, 'utf-8');
        assert.match(updatedContent, /UPDATED helper/, 'Helper should be updated');
        assert.ok(fs.existsSync(path.join(testDir, '.agent', 'skills', 'my-sample-skill', 'newfile.txt')));

        // Revert mock modification
        fs.writeFileSync(path.join(mockRepoDir, 'helper.js'), 'console.log("skill helper");');
        fs.unlinkSync(path.join(mockRepoDir, 'newfile.txt'));
    });

    test('`pphat update skill` with no args updates all installed skills', () => {
        execSync(`npx tsx ${cliPath} add skill ${mockRepoDir} ${mockMultiRepoDir}`, { cwd: testDir, encoding: 'utf-8' });

        const output = execSync(`npx tsx ${cliPath} update skill`, {
            cwd: testDir,
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'pipe']
        });
        assert.match(output, /my-sample-skill/);
        assert.match(output, /skill-one/);
        assert.match(output, /skill-two/);
    });

    test('`pphat remove skill <source>` removes skill by source name and updates manifest', () => {
        execSync(`npx tsx ${cliPath} add skill ${mockRepoDir}`, { cwd: testDir, encoding: 'utf-8' });
        const skillPath = path.join(testDir, '.agent', 'skills', 'my-sample-skill');
        assert.ok(fs.existsSync(skillPath));

        execSync(`npx tsx ${cliPath} remove skill ${mockRepoDir}`, { cwd: testDir, encoding: 'utf-8' });
        assert.ok(!fs.existsSync(skillPath), 'Skill directory should be removed');

        const manifest = JSON.parse(fs.readFileSync(path.join(testDir, '.skills.json'), 'utf-8'));
        assert.strictEqual(manifest.skills[mockRepoDir], undefined, 'Manifest entry should be removed');
    });

    test('`pphat remove skill <skillName>` removes specific skill by individual name', () => {
        execSync(`npx tsx ${cliPath} add skill ${mockMultiRepoDir}`, { cwd: testDir, encoding: 'utf-8' });
        const skill1Path = path.join(testDir, '.agent', 'skills', 'skill-one');
        const skill2Path = path.join(testDir, '.agent', 'skills', 'skill-two');
        assert.ok(fs.existsSync(skill1Path));
        assert.ok(fs.existsSync(skill2Path));

        execSync(`npx tsx ${cliPath} remove skill skill-one`, { cwd: testDir, encoding: 'utf-8' });
        assert.ok(!fs.existsSync(skill1Path), 'Skill one should be removed');
        assert.ok(fs.existsSync(skill2Path), 'Skill two should remain');

        const manifest = JSON.parse(fs.readFileSync(path.join(testDir, '.skills.json'), 'utf-8'));
        const entry = manifest.skills[mockMultiRepoDir];
        assert.strictEqual(entry.skills.length, 1);
        assert.strictEqual(entry.skills[0].name, 'skill-two');
    });

    test('`pphat remove skill <name1> <name2>` removes multiple skills in one command', () => {
        execSync(`npx tsx ${cliPath} add skill ${mockMultiRepoDir}`, { cwd: testDir, encoding: 'utf-8' });
        const skill1Path = path.join(testDir, '.agent', 'skills', 'skill-one');
        const skill2Path = path.join(testDir, '.agent', 'skills', 'skill-two');

        execSync(`npx tsx ${cliPath} remove skill skill-one skill-two`, { cwd: testDir, encoding: 'utf-8' });
        assert.ok(!fs.existsSync(skill1Path));
        assert.ok(!fs.existsSync(skill2Path));
    });

    test('`pphat list skills` displays installed skills', () => {
        execSync(`npx tsx ${cliPath} add skill ${mockMultiRepoDir}`, { cwd: testDir, encoding: 'utf-8' });

        const output = execSync(`npx tsx ${cliPath} list skills`, { cwd: testDir, encoding: 'utf-8' });
        assert.match(output, /Installed Skills:/);
        assert.match(output, /skill-one/);
        assert.match(output, /skill-two/);
    });

    test('`pphat add skill <source> --list` inspects available skills without installing', () => {
        const output = execSync(`npx tsx ${cliPath} add skill ${mockMultiRepoDir} --list`, {
            cwd: testDir,
            encoding: 'utf-8'
        });
        assert.match(output, /Available skills in/);
        assert.match(output, /skill-one/);
        assert.match(output, /skill-two/);

        // Verify nothing was actually installed
        assert.ok(!fs.existsSync(path.join(testDir, '.agent', 'skills')));
    });

    test('`pphat add skill <source> --skill <name>` installs only the specified skill', () => {
        execSync(`npx tsx ${cliPath} add skill ${mockMultiRepoDir} --skill skill-two -y`, {
            cwd: testDir,
            encoding: 'utf-8'
        });

        assert.ok(!fs.existsSync(path.join(testDir, '.agent', 'skills', 'skill-one')));
        assert.ok(fs.existsSync(path.join(testDir, '.agent', 'skills', 'skill-two')));
    });

    test('`pphat add skill <source> -a <agent>` installs into specified agent directory (e.g. claude)', () => {
        execSync(`npx tsx ${cliPath} add skill ${mockRepoDir} -a claude -y`, {
            cwd: testDir,
            encoding: 'utf-8'
        });

        const claudeSkillPath = path.join(testDir, '.claude', 'skills', 'my-sample-skill');
        assert.ok(fs.existsSync(claudeSkillPath), `Skill should be installed into .claude/skills`);
    });

    test('`skills-lock.json` tracks additions, updates, and removals with computedHash', () => {
        const lockPath = path.join(testDir, 'skills-lock.json');

        // 1. Add skill
        execSync(`npx tsx ${cliPath} add skill ${mockMultiRepoDir}`, { cwd: testDir, encoding: 'utf-8' });
        assert.ok(fs.existsSync(lockPath), 'Lockfile should exist');
        let lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
        assert.ok(lock.skills['skill-one'], 'skill-one should be locked');
        assert.ok(lock.skills['skill-two'], 'skill-two should be locked');
        assert.strictEqual(typeof lock.skills['skill-one'].computedHash, 'string');
        const originalHash = lock.skills['skill-one'].computedHash;

        // 2. Remove one skill
        execSync(`npx tsx ${cliPath} remove skill skill-one`, { cwd: testDir, encoding: 'utf-8' });
        lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
        assert.strictEqual(lock.skills['skill-one'], undefined, 'skill-one should be removed from lockfile');
        assert.ok(lock.skills['skill-two'], 'skill-two should still be present');

        // 3. Remove all remaining
        execSync(`npx tsx ${cliPath} remove skill skill-two`, { cwd: testDir, encoding: 'utf-8' });
        lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
        assert.deepStrictEqual(lock.skills, {}, 'All skills should be removed from lockfile');
    });

    test('Hyphenated commands `add-skill`, `update-skill`, `remove-skill` work directly', () => {
        execSync(`npx tsx ${cliPath} add-skill ${mockRepoDir}`, { cwd: testDir, encoding: 'utf-8' });
        const skillPath = path.join(testDir, '.agent', 'skills', 'my-sample-skill');
        assert.ok(fs.existsSync(skillPath));

        execSync(`npx tsx ${cliPath} update-skill ${mockRepoDir}`, { cwd: testDir, encoding: 'utf-8' });
        assert.ok(fs.existsSync(skillPath));

        execSync(`npx tsx ${cliPath} remove-skill ${mockRepoDir}`, { cwd: testDir, encoding: 'utf-8' });
        assert.ok(!fs.existsSync(skillPath));
    });

    test('Error handling: `add skill` with no names exits 1', () => {
        assert.throws(
            () => execSync(`npx tsx ${cliPath} add skill`, { cwd: testDir, encoding: 'utf-8', stdio: 'pipe' }),
            (err: Error & { status?: number; stderr?: string }) => {
                assert.strictEqual(err.status, 1);
                assert.match(String(err.stderr ?? ''), /Please provide at least one skill source/);
                return true;
            }
        );
    });

    test('Error handling: `update foo` exits 1 with hint', () => {
        assert.throws(
            () => execSync(`npx tsx ${cliPath} update foo`, { cwd: testDir, encoding: 'utf-8', stdio: 'pipe' }),
            (err: Error & { status?: number; stderr?: string }) => {
                assert.strictEqual(err.status, 1);
                assert.match(String(err.stderr ?? ''), /Unknown target "foo"/);
                assert.match(String(err.stderr ?? ''), /Expected `skill`/);
                return true;
            }
        );
    });
});
