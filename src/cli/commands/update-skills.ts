import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';

import {
    parseSkillSource,
    getSkillsTargetDir,
    loadSkillsManifest,
    saveSkillsManifest,
    loadSkillsLock,
    saveSkillsLock,
    computeSkillFolderHash,
    getSourceType,
    cloneOrFetchRepo,
    discoverSkills,
    installSkill,
    InstalledSkillItem
} from '../../core/skills';

export interface UpdateSkillsOptions {
    dir?: string;
    global?: boolean;
}

/**
* Update Skills Logic
* @description Refreshes and updates installed skills to their latest versions
* @param targets Specific skill sources/names to update, or empty to update all installed skills
* @param options Target directory or global installation options
* @returns Promise resolving when update completes
*/
export async function runUpdateSkills(targets: string[] = [], options: UpdateSkillsOptions = {}): Promise<void> {
    const manifest = await loadSkillsManifest(process.cwd());
    const installedEntries = Object.entries(manifest.skills);

    let itemsToUpdate: string[] = targets;

    if (!itemsToUpdate || itemsToUpdate.length === 0) {
        if (installedEntries.length === 0) {
            console.log(chalk.yellow('No installed skills found in .skills.json to update.'));
            return;
        }
        itemsToUpdate = Object.keys(manifest.skills);
    }

    const defaultTargetDir = await getSkillsTargetDir(options);

    for (const target of itemsToUpdate) {
        const spinner = ora(`Updating skill "${target}"...`).start();

        try {
            // Check if target is recorded in manifest
            const existingEntry =
                manifest.skills[target] ||
                installedEntries.find(([k, v]) => k.toLowerCase() === target.toLowerCase() || v.source.toLowerCase() === target.toLowerCase())?.[1];

            const source = existingEntry ? existingEntry.source : target;
            const parsed = parseSkillSource(source);

            // Use configured directory from entry if available, or CLI option / default
            const targetDir = options.dir
                ? path.resolve(process.cwd(), options.dir)
                : existingEntry?.targetDir
                ? path.resolve(process.cwd(), existingEntry.targetDir)
                : defaultTargetDir;

            spinner.text = `Fetching latest changes for "${parsed.repoUrl}"...`;
            const { tempDir, cleanup } = await cloneOrFetchRepo(parsed);

            try {
                spinner.text = `Discovering skills in "${source}"...`;
                const skills = await discoverSkills(tempDir, parsed.subpath, parsed.repoName);

                if (!skills || skills.length === 0) {
                    spinner.fail(chalk.red(`No valid skills found in "${source}".`));
                    continue;
                }

                const updatedList: InstalledSkillItem[] = [];

                for (const item of skills) {
                    spinner.text = `Updating skill "${item.name}"...`;
                    const destPath = await installSkill(item.sourceDir, targetDir, item.name);
                    updatedList.push({
                        name: item.name,
                        dir: path.relative(process.cwd(), destPath) || destPath,
                        description: item.description
                    });
                }

                const now = new Date().toISOString();
                const manifestKey = existingEntry ? existingEntry.source : parsed.raw;

                manifest.skills[manifestKey] = {
                    source: parsed.raw,
                    url: parsed.repoUrl,
                    ref: parsed.ref,
                    targetDir: path.relative(process.cwd(), targetDir) || targetDir,
                    installedAt: manifest.skills[manifestKey]?.installedAt || now,
                    updatedAt: now,
                    skills: updatedList
                };

                await saveSkillsManifest(manifest, process.cwd());

                // Update skills-lock.json
                const lock = await loadSkillsLock(process.cwd());
                const sourceType = getSourceType(parsed);

                for (const item of skills) {
                    const hash = await computeSkillFolderHash(item.sourceDir);
                    lock.skills[item.name] = {
                        source: parsed.raw,
                        sourceType,
                        skillPath: item.skillPath,
                        computedHash: hash
                    };
                }

                await saveSkillsLock(lock, process.cwd());

                spinner.succeed(chalk.green(`Updated ${skills.length} skill(s) from "${target}":`));
                for (const item of skills) {
                    console.log(chalk.gray(`  ✔ ${chalk.cyan(item.name)}${item.description ? chalk.dim(` — ${item.description}`) : ''}`));
                }
            } finally {
                await cleanup();
            }
        } catch (err: any) {
            spinner.fail(chalk.red(`Failed to update skill "${target}": ${err.message || err}`));
        }
    }
}

/**
* Update Skill Command
* @description Standalone command for updating skills (`pphat update-skill [targets...]`)
*/
export const updateSkillCommand = new Command('update-skill')
    .description('Update previously installed AI agent skills to their latest versions')
    .argument('[targets...]', 'Repository shorthands or skill names (omit to update all installed skills)')
    .option('-d, --dir <dir>', 'Custom target directory for skills')
    .option('-g, --global', 'Update globally installed skills in ~/.agent/skills')
    .addHelpText('after', `
${chalk.blue.bold('Examples:')}
  $ pphat update skill pphatdev/skills
  $ pphat update skill pphatdev/skills pphatdev/skills2
  $ pphat update skill                 # Update all installed skills
  $ pphat update-skill pphatdev/skills
`)
    .action(async (targets: string[], options: UpdateSkillsOptions) => {
        await runUpdateSkills(targets, options);
    });

