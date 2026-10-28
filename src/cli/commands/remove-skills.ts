import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';

import {
    getSkillsTargetDir,
    loadSkillsManifest,
    saveSkillsManifest,
    loadSkillsLock,
    saveSkillsLock,
    removeSkillFiles
} from '../../core/skills';

export interface RemoveSkillsOptions {
    dir?: string;
    global?: boolean;
}

/**
* Remove Skills Logic
* @description Uninstalls and removes skills from the target directory and manifest
* @param targets Skill names, repository shorthands, or URLs to remove
* @param options Target directory or global installation options
* @returns Promise resolving when removal completes
*/
export async function runRemoveSkills(targets: string[], options: RemoveSkillsOptions = {}): Promise<void> {
    if (!targets || targets.length === 0) {
        console.error(chalk.red('Please provide at least one skill name or repository (e.g. `pphat remove skill pphatdev/skills`).'));
        process.exit(1);
    }

    const defaultTargetDir = await getSkillsTargetDir(options);
    const manifest = await loadSkillsManifest(process.cwd());
    const lock = await loadSkillsLock(process.cwd());

    for (const target of targets) {
        const spinner = ora(`Looking up skill "${target}"...`).start();
        const lowerTarget = target.toLowerCase();

        let removedAny = false;

        // 1. Check if target matches a manifest entry key or source (e.g. pphatdev/skills)
        const matchedKey = Object.keys(manifest.skills).find(
            k => k.toLowerCase() === lowerTarget || manifest.skills[k].source.toLowerCase() === lowerTarget
        );

        if (matchedKey) {
            const entry = manifest.skills[matchedKey];
            const targetDir = entry.targetDir ? path.resolve(process.cwd(), entry.targetDir) : defaultTargetDir;

            for (const skillItem of entry.skills) {
                const skillPath = skillItem.dir
                    ? path.resolve(process.cwd(), skillItem.dir)
                    : path.join(targetDir, skillItem.name);
                await removeSkillFiles(skillPath);
                delete lock.skills[skillItem.name];
            }

            // Also check for any lock entries with matching source
            for (const [k, v] of Object.entries(lock.skills)) {
                if (v.source.toLowerCase() === lowerTarget) {
                    delete lock.skills[k];
                }
            }

            delete manifest.skills[matchedKey];
            await saveSkillsManifest(manifest, process.cwd());
            await saveSkillsLock(lock, process.cwd());
            removedAny = true;
            spinner.succeed(chalk.green(`Removed skill(s) from "${target}".`));
            continue;
        }

        // 2. Check if target matches an individual skill name inside any manifest entry
        for (const [key, entry] of Object.entries(manifest.skills)) {
            const skillIndex = entry.skills.findIndex(s => s.name.toLowerCase() === lowerTarget);
            if (skillIndex !== -1) {
                const skillItem = entry.skills[skillIndex];
                const skillPath = skillItem.dir
                    ? path.resolve(process.cwd(), skillItem.dir)
                    : path.join(defaultTargetDir, skillItem.name);
                await removeSkillFiles(skillPath);

                entry.skills.splice(skillIndex, 1);
                if (entry.skills.length === 0) {
                    delete manifest.skills[key];
                }
                delete lock.skills[skillItem.name];
                delete lock.skills[target];

                await saveSkillsManifest(manifest, process.cwd());
                await saveSkillsLock(lock, process.cwd());
                removedAny = true;
                spinner.succeed(chalk.green(`Removed skill "${target}".`));
                break;
            }
        }

        if (removedAny) continue;

        // 3. Check if target matches directly in skills-lock.json
        if (lock.skills[target] || Object.keys(lock.skills).some(k => k.toLowerCase() === lowerTarget)) {
            const exactKey = Object.keys(lock.skills).find(k => k.toLowerCase() === lowerTarget) || target;
            delete lock.skills[exactKey];
            await saveSkillsLock(lock, process.cwd());
            const directPath = path.join(defaultTargetDir, target);
            await removeSkillFiles(directPath);
            removedAny = true;
            spinner.succeed(chalk.green(`Removed skill "${target}".`));
            continue;
        }

        // 4. Fallback: check direct folder existence in targetDir
        const directPath = path.join(defaultTargetDir, target);
        if (await removeSkillFiles(directPath)) {
            delete lock.skills[target];
            await saveSkillsLock(lock, process.cwd());
            spinner.succeed(chalk.green(`Removed skill directory "${target}".`));
            continue;
        }

        // 5. Fallback: check by repo name if user passed owner/repo
        const repoName = target.split('/').pop();
        if (repoName && repoName !== target) {
            const repoPath = path.join(defaultTargetDir, repoName);
            if (await removeSkillFiles(repoPath)) {
                delete lock.skills[repoName];
                await saveSkillsLock(lock, process.cwd());
                spinner.succeed(chalk.green(`Removed skill directory "${repoName}".`));
                continue;
            }
        }

        spinner.warn(chalk.yellow(`Skill "${target}" was not found or is already removed.`));
    }
}

/**
* Remove Skill Command
* @description Standalone command for removing skills (`pphat remove-skill <targets...>`)
*/
export const removeSkillCommand = new Command('remove-skill')
    .description('Remove previously installed AI agent skills')
    .argument('<targets...>', 'Repository shorthands or skill names to remove')
    .option('-d, --dir <dir>', 'Custom target directory for skills')
    .option('-g, --global', 'Remove from global skills directory (~/.agent/skills)')
    .addHelpText('after', `
${chalk.blue.bold('Examples:')}
  $ pphat remove skill pphatdev/skills
  $ pphat remove skill pphatdev/skills pphatdev/skills2
  $ pphat remove-skill pphatdev/skills
`)
    .action(async (targets: string[], options: RemoveSkillsOptions) => {
        await runRemoveSkills(targets, options);
    });

