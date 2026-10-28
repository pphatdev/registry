import { Command } from 'commander';
import chalk from 'chalk';

import { runRemoveIcons } from './remove-icons';
import { runRemoveComponents } from './remove-components';
import { runRemoveSkills } from './remove-skills';

interface RemoveParentOptions {
    format?: 'nextjs' | 'nuxtjs' | 'svg';
    dir?: string;
    global?: boolean;
}

/**
* `pphat remove ...` — parent command with three forms:
*   pphat remove icon <names...>      → runRemoveIcons
*   pphat remove component <names...> → runRemoveComponents
*   pphat remove skill <names...>     → runRemoveSkills
*
* Unlike `add`, `remove` has no legacy shortcut — the caller must be explicit about
* whether they're deleting icons, components, or skills to prevent accidents.
*/
export const removeCommand = new Command('remove')
    .description('Remove previously downloaded icons or components (grammar: `remove icon <names...>`, `remove component <names...>`, or `remove skill <names...>`)')
    .argument('[items...]', '`icon`/`component`/`skill` followed by names')
    .option('-f, --format <format>', 'Format to remove (svg, nextjs, nuxtjs — svg is icons only)')
    .option('-d, --dir <dir>', 'Custom directory the items were saved to')
    .option('-g, --global', 'Remove from global skills directory (~/.agent/skills)')
    .addHelpText('after', `
${chalk.blue.bold('Examples:')}
  $ pphat remove icon react vue
  $ pphat remove icon react -f svg -d public/icons
  $ pphat remove component button card
  $ pphat remove component modal -f nextjs
  $ pphat remove skill pphatdev/skills
  $ pphat remove skill pphatdev/skills pphatdev/skills2
`)
    .action(async (items: string[], options: RemoveParentOptions) => {
        if (!items || items.length === 0) {
            console.error(chalk.red('Nothing to remove. Try `pphat remove icon <names...>` or `pphat remove component <names...>` or `pphat remove skill <names...>` .'));
            process.exit(1);
        }

        const first = items[0].toLowerCase();
        if (first === 'icon' || first === 'icons') {
            return runRemoveIcons(items.slice(1), options);
        }
        if (first === 'component' || first === 'components' || first === 'comp') {
            if (options.format === 'svg') {
                console.error(chalk.red('Invalid format "svg" for components. Components only support "nextjs" or "nuxtjs".'));
                process.exit(1);
            }
            return runRemoveComponents(items.slice(1), {
                ...options,
                format: options.format
            });
        }
        if (first === 'skill' || first === 'skills') {
            return runRemoveSkills(items.slice(1), options);
        }
        console.error(chalk.red(`Unknown target "${items[0]}". Expected \`icon\` or \`component\` or \`skill\`.`));
        console.error(chalk.yellow('Usage: pphat remove icon <names...>   or   pphat remove component <names...>   or   pphat remove skill <names...>'));
        process.exit(1);
    });
