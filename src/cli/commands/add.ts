import { Command } from 'commander';
import chalk from 'chalk';

import { runAddIcons } from './add-icons';
import { runAddComponents } from './add-components';
import { runAddSkills } from './add-skills';

interface AddParentOptions {
    format?: 'nextjs' | 'nuxtjs' | 'svg';
    dir?: string;
    global?: boolean;
    skill?: string | string[];
    agent?: string | string[];
    yes?: boolean;
    all?: boolean;
    list?: boolean;
}

/**
* `pphat add ...` — parent command with four forms:
*   pphat add icon <names...>      → runAddIcons
*   pphat add component <names...> → runAddComponents
*   pphat add skill <names...>     → runAddSkills
*   pphat add <names...>           → runAddIcons (legacy; the original `add` alias behaviour)
*/
export const addCommand = new Command('add')
    .description('Add icons or components to your project (grammar: `add icon <names...>`, `add component <names...>`, or `add skill <names...>`)')
    .argument('[items...]', 'Either `icon`/`component`/`skill` followed by names, or just icon names (legacy shortcut)')
    .option('-f, --format <format>', 'Override format (svg, nextjs, nuxtjs — svg is icons only)')
    .option('-d, --dir <dir>', 'Custom target directory to save downloaded items')
    .option('-g, --global', 'Install skills globally to ~/.agent/skills')
    .option('-s, --skill <skills...>', 'Install specific skill(s) by name (* for all)')
    .option('-a, --agent <agents...>', 'Target specific coding agent(s) (claude, cursor, agent, etc.)')
    .option('-y, --yes', 'Skip interactive prompts and install with defaults')
    .option('--all', 'Install all available skills from the repository without prompting')
    .option('-l, --list', 'Only list available skills in the repository without installing')
    .addHelpText('after', `
${chalk.blue.bold('Examples:')}
  $ pphat add icon react vue github
  $ pphat add icon react -f svg -d public/icons
  $ pphat add component button card
  $ pphat add component modal -f nextjs
  $ pphat add skill pphatdev/skills
  $ pphat add skill pphatdev/skills pphatdev/skills1 pphatdev/skills2
  $ pphat add skill pphatdev/skills -a claude cursor
  $ pphat add skill pphatdev/skills --list
  $ pphat add react vue                ${chalk.dim('# legacy: same as `add icon react vue`')}
`)
    .action(async (items: string[], options: AddParentOptions) => {
        if (!items || items.length === 0) {
            console.error(chalk.red('Nothing to add. Try `pphat add icon <names...>`, `pphat add component <names...>`, or `pphat add skill <names...>`.'));
            process.exit(1);
        }

        const first = items[0].toLowerCase();
        if (first === 'icon' || first === 'icons') {
            return runAddIcons(items.slice(1), options);
        }
        if (first === 'component' || first === 'components' || first === 'comp') {
            if (options.format === 'svg') {
                console.error(chalk.red('Invalid format "svg" for components. Components only support "nextjs" or "nuxtjs".'));
                process.exit(1);
            }
            return runAddComponents(items.slice(1), {
                ...options,
                format: options.format
            });
        }
        if (first === 'skill' || first === 'skills') {
            return runAddSkills(items.slice(1), options);
        }
        // Legacy: `pphat add react vue` == `pphat add icon react vue`
        return runAddIcons(items, options);
    });
