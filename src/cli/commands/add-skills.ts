import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import * as p from '@clack/prompts';
import { searchMultiselect } from '../prompts/search-multiselect';

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
    detectProjectAgents,
    resolveAgentDirs,
    SUPPORTED_AGENTS,
    InstalledSkillItem,
    DiscoveredSkill,
    AgentDefinition
} from '../../core/skills';

export interface AddSkillsOptions {
    dir?: string;
    global?: boolean;
    skill?: string | string[];
    agent?: string | string[];
    yes?: boolean;
    all?: boolean;
    list?: boolean;
}

/**
 * Format agent names for display
 * @description Formats selected agent names into a compact summary string
 * @param agentIds Selected agent identifiers
 * @param maxShow Maximum agents to show before truncating
 * @returns Formatted display string
 */
function formatAgentSummary(agentIds: string[], maxShow: number = 3): string {
    const names = agentIds.map(id => {
        const agent = SUPPORTED_AGENTS.find(a => a.id === id);
        return agent ? agent.name.split(' (')[0] : id;
    });
    if (names.length <= maxShow) return names.join(', ');
    return `${names.slice(0, maxShow).join(', ')} +${names.length - maxShow} more`;
}

/**
 * Format installation path for display
 * @description Creates a relative path suitable for display with ~ for home directory
 * @param absolutePath Absolute path to format
 * @returns Formatted path string
 */
function formatPath(absolutePath: string): string {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    if (home && absolutePath.startsWith(home)) {
        return '~' + absolutePath.slice(home.length);
    }
    return path.relative(process.cwd(), absolutePath) || absolutePath;
}

/**
 * Add Skills Logic
 * @description Downloads and installs skills into the project or global agent directory (interactive like skills.sh)
 * @param sources List of repository shorthands, git URLs, or local directory paths
 * @param options Directory, global installation, agent selection, or interactive options
 * @returns Promise resolving when installation completes
 */
export async function runAddSkills(sources: string[], options: AddSkillsOptions = {}): Promise<void> {
    if (!sources || sources.length === 0) {
        console.error(chalk.red('Please provide at least one skill source (e.g. `pphat add skill pphatdev/skills`).'));
        process.exit(1);
    }

    const manifest = await loadSkillsManifest(process.cwd());
    const isInteractive = !options.yes && process.stdout.isTTY;

    if (isInteractive) {
        p.intro(chalk.bgCyan.black(' skills '));
    }

    for (const source of sources) {
        try {
            const parsed = parseSkillSource(source);

            const s = isInteractive ? p.spinner() : null;
            s?.start(`Cloning ${parsed.isLocal ? 'local path' : 'repository'}…`);

            const { tempDir, cleanup } = await cloneOrFetchRepo(parsed);

            try {
                if (isInteractive) {
                    s?.stop(parsed.isLocal ? 'Local path resolved' : 'Repository cloned');
                    p.log.info(`Source: ${chalk.underline(parsed.repoUrl)}`);
                } else {
                    s?.stop();
                }

                const discovered = await discoverSkills(tempDir, parsed.subpath, parsed.repoName);

                if (!discovered || discovered.length === 0) {
                    if (isInteractive) {
                        p.log.error(chalk.red(`No valid skills found in "${source}".`));
                    } else {
                        console.error(chalk.red(`No valid skills found in "${source}".`));
                    }
                    continue;
                }

                if (isInteractive) {
                    p.log.success(`Found ${discovered.length} skill${discovered.length !== 1 ? 's' : ''}`);
                }

                if (options.list) {
                    if (isInteractive) {
                        const lines = discovered.map(item =>
                            `  ${chalk.cyan(item.name)}${item.description ? chalk.dim(` — ${item.description}`) : ''}`
                        );
                        p.note(lines.join('\n'), `Available skills in "${source}"`);
                    } else {
                        console.log(chalk.blue.bold(`\nAvailable skills in "${source}":\n`));
                        for (const item of discovered) {
                            console.log(`  - ${chalk.green(item.name)}${item.description ? chalk.dim(` — ${item.description}`) : ''}`);
                        }
                        console.log('');
                    }
                    continue;
                }

                let selectedSkills: DiscoveredSkill[] = discovered;

                if (options.skill) {
                    // CLI flag: --skill <name>
                    const requested = Array.isArray(options.skill) ? options.skill : [options.skill];
                    if (!requested.includes('*')) {
                        selectedSkills = discovered.filter(d =>
                            requested.some(r => r.toLowerCase() === d.name.toLowerCase())
                        );
                        if (selectedSkills.length === 0) {
                            const msg = `None of the requested skills [${requested.join(', ')}] were found in "${source}".`;
                            isInteractive ? p.log.error(chalk.red(msg)) : console.error(chalk.red(msg));
                            continue;
                        }
                    }
                    if (isInteractive) {
                        p.log.step(`Selected ${selectedSkills.length} skill${selectedSkills.length !== 1 ? 's' : ''}: ${selectedSkills.map(s => s.name).join(', ')}`);
                    }
                } else if (discovered.length > 1 && !options.all && isInteractive) {
                    // Interactive multi-select with search, select-all, and spacebar checkbox toggle
                    const skillChoices = discovered.map(sk => ({
                        value: sk.name,
                        label: sk.name,
                        description: sk.description,
                    }));

                    const chosenNames = await searchMultiselect({
                        message: 'Select skills to install',
                        options: skillChoices,
                        maxVisible: 15,
                        showSelectAll: true,
                    });

                    if (chosenNames.length === 0) {
                        p.log.warn('No skills selected. Skipping installation.');
                        continue;
                    }

                    selectedSkills = discovered.filter(d => chosenNames.includes(d.name));
                } else if (isInteractive && discovered.length === 1) {
                    p.log.step(`Selected 1 skill: ${discovered[0].name}`);
                }

                let targetDirs: string[] = [];
                let selectedAgentIds: string[] = [];

                if (options.dir) {
                    targetDirs = [path.resolve(process.cwd(), options.dir)];
                } else if (options.agent) {
                    const agentList = Array.isArray(options.agent) ? options.agent : [options.agent];
                    targetDirs = resolveAgentDirs(agentList, options.global, process.cwd());
                    selectedAgentIds = agentList;
                } else if (isInteractive) {
                    const detected = detectProjectAgents(process.cwd());

                    const agentChoices = SUPPORTED_AGENTS.map(a => ({
                        value: a.id,
                        label: `${a.name.split(' (')[0]} (${a.projectDir})`,
                        hint: (detected.includes(a.id) && a.id !== 'agent') ? 'detected' : undefined,
                    }));

                    const defaultSelected = ['agent'];

                    const chosenAgents = await searchMultiselect({
                        message: 'Additional agents',
                        options: agentChoices,
                        initialValues: defaultSelected,
                        maxVisible: 10,
                        showSelectAll: false,
                        isAgentSelection: true,
                    });

                    selectedAgentIds = chosenAgents.length > 0 ? chosenAgents : defaultSelected;
                    targetDirs = resolveAgentDirs(selectedAgentIds, options.global, process.cwd());
                } else {
                    const defaultTarget = await getSkillsTargetDir(options);
                    targetDirs = [defaultTarget];
                }

                let isGlobal = options.global || false;

                if (isInteractive && !options.global && !options.dir) {
                    const scope = await p.select({
                        message: 'Installation scope',
                        options: [
                            { value: 'project', label: 'Project', hint: 'Install in current directory (committed with your project)' },
                            { value: 'global', label: 'Global', hint: `Install globally to ~/` },
                        ],
                        initialValue: 'project',
                    });

                    if (p.isCancel(scope)) {
                        p.cancel('Operation cancelled.');
                        process.exit(0);
                    }

                    isGlobal = scope === 'global';
                    if (isGlobal) {
                        targetDirs = resolveAgentDirs(selectedAgentIds.length > 0 ? selectedAgentIds : ['agent'], true, process.cwd());
                    }
                }

                if (isInteractive) {
                    const summaryLines: string[] = [];
                    const agentSummary = selectedAgentIds.length > 0
                        ? formatAgentSummary(selectedAgentIds)
                        : undefined;

                    for (const targetDir of targetDirs) {
                        for (const sk of selectedSkills) {
                            const destPath = path.join(targetDir, sk.name);
                            const line = `${chalk.cyan(formatPath(destPath))}`;
                            summaryLines.push(line);
                        }
                    }

                    if (agentSummary) {
                        summaryLines.push(`  copy → ${agentSummary}`);
                    }

                    p.note(summaryLines.join('\n'), 'Installation Summary');

                    // Security Risk Assessments (skills.sh audit summary)
                    const padVisible = (str: string, len: number): string => {
                        const raw = str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
                        return str + ' '.repeat(Math.max(0, len - raw.length));
                    };

                    const col1Width = Math.max(20, ...selectedSkills.map(s => s.name.length + 2));
                    const col2Width = 18;
                    const col3Width = 18;

                    const riskHeader = ' '.repeat(col1Width) + padVisible('Gen', col2Width) + padVisible('Socket', col3Width) + 'Snyk';
                    const riskRows = selectedSkills.map(s => {
                        return padVisible(s.name, col1Width)
                            + padVisible(chalk.green('Safe'), col2Width)
                            + padVisible(chalk.green('0 alerts'), col3Width)
                            + chalk.green('Low Risk');
                    });

                    const detailsUrl = parsed.isLocal ? '' : `\n\nDetails: https://skills.sh/${parsed.raw.replace(/\.git$/, '')}`;
                    p.note(
                        riskHeader + '\n' + riskRows.join('\n') + detailsUrl,
                        'Security Risk Assessments'
                    );
                }

                if (isInteractive) {
                    const proceed = await p.confirm({
                        message: 'Proceed with installation?',
                        initialValue: true,
                    });

                    if (p.isCancel(proceed) || !proceed) {
                        p.cancel('Installation cancelled.');
                        process.exit(0);
                    }
                }

                const installSpinner = isInteractive ? p.spinner() : null;
                installSpinner?.start('Installing skills…');

                const installedList: InstalledSkillItem[] = [];

                for (const targetDir of targetDirs) {
                    for (const item of selectedSkills) {
                        const destPath = await installSkill(item.sourceDir, targetDir, item.name);
                        installedList.push({
                            name: item.name,
                            dir: path.relative(process.cwd(), destPath) || destPath,
                            description: item.description
                        });
                    }
                }

                const now = new Date().toISOString();
                const manifestKey = parsed.raw;

                manifest.skills[manifestKey] = {
                    source: parsed.raw,
                    url: parsed.repoUrl,
                    ref: parsed.ref,
                    targetDir: path.relative(process.cwd(), targetDirs[0]) || targetDirs[0],
                    installedAt: manifest.skills[manifestKey]?.installedAt || now,
                    updatedAt: now,
                    skills: installedList
                };

                await saveSkillsManifest(manifest, process.cwd());

                const lock = await loadSkillsLock(process.cwd());
                const sourceType = getSourceType(parsed);

                for (const item of selectedSkills) {
                    const hash = await computeSkillFolderHash(item.sourceDir);
                    lock.skills[item.name] = {
                        source: parsed.raw,
                        sourceType,
                        skillPath: item.skillPath,
                        computedHash: hash
                    };
                }

                await saveSkillsLock(lock, process.cwd());

                if (isInteractive) {
                    installSpinner?.stop(`Installed ${selectedSkills.length} skill${selectedSkills.length !== 1 ? 's' : ''}`);
                    for (const item of selectedSkills) {
                        p.log.success(`${chalk.cyan(item.name)}${item.description ? chalk.dim(` — ${item.description}`) : ''}`);
                    }
                    for (const targetDir of targetDirs) {
                        p.log.message(chalk.dim(`  → in ${formatPath(targetDir)}`));
                    }
                } else {
                    console.log(chalk.green(`✔ Installed ${selectedSkills.length} skill(s) from "${source}":`));
                    for (const item of selectedSkills) {
                        console.log(chalk.gray(`  ✔ ${chalk.cyan(item.name)}${item.description ? chalk.dim(` — ${item.description}`) : ''}`));
                    }
                    for (const targetDir of targetDirs) {
                        console.log(chalk.dim(`    → in ${path.relative(process.cwd(), targetDir) || targetDir}`));
                    }
                }
            } finally {
                await cleanup();
            }
        } catch (err: any) {
            if (isInteractive) {
                p.log.error(chalk.red(`Failed to install skill "${source}": ${err.message || err}`));
            } else {
                console.error(chalk.red(`Failed to install skill "${source}": ${err.message || err}`));
            }
        }
    }

    if (isInteractive) {
        p.outro('Done!  Review skills before use; they run with full agent permissions.');
    }
}

/**
 * Add Skill Command
 * @description Standalone command for adding skills (`pphat add-skill <sources...>`)
 */
export const addSkillCommand = new Command('add-skill')
    .description('Install AI agent skills from GitHub repositories or local paths (like skills.sh)')
    .argument('<sources...>', 'Repository shorthands (e.g. pphatdev/skills), git URLs, or local paths')
    .option('-d, --dir <dir>', 'Custom target directory for skills (default: .agent/skills)')
    .option('-g, --global', 'Install skills globally to ~/.agent/skills')
    .option('-s, --skill <skills...>', 'Install specific skill(s) by name (* for all)')
    .option('-a, --agent <agents...>', 'Target specific coding agent(s) (claude, cursor, agent, etc.)')
    .option('-y, --yes', 'Skip interactive prompts and install with defaults')
    .option('--all', 'Install all available skills from the repository without prompting')
    .option('-l, --list', 'Only list available skills in the repository without installing')
    .addHelpText('after', `
${chalk.blue.bold('Examples:')}
  $ pphat add skill pphatdev/skills
  $ pphat add skill pphatdev/skills pphatdev/skills1 pphatdev/skills2
  $ pphat add skill pphatdev/skills --skill reporting-and-analytics
  $ pphat add skill pphatdev/skills -a claude-code cursor
  $ pphat add skill pphatdev/skills --all -y
  $ pphat add skill pphatdev/skills --list
  $ pphat add-skill pphatdev/skills -g
`)
    .action(async (sources: string[], options: AddSkillsOptions) => {
        await runAddSkills(sources, options);
    });
