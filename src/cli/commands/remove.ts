import { Command } from 'commander';
import chalk from 'chalk';

import { runRemoveIcons } from './remove-icons';
import { runRemoveComponents } from './remove-components';

interface RemoveParentOptions {
    format?: 'nextjs' | 'nuxtjs' | 'svg';
    dir?: string;
}

/**
* `pphat remove ...` — parent command with two forms:
*   pphat remove icon <names...>      → runRemoveIcons
*   pphat remove component <names...> → runRemoveComponents
*
* Unlike `add`, `remove` has no legacy shortcut — the caller must be explicit about
* whether they're deleting icons or components to prevent accidents.
*/
export const removeCommand = new Command('remove')
    .description('Remove previously downloaded icons or components (grammar: `remove icon <names...>` or `remove component <names...>`)')
    .argument('[items...]', '`icon`/`component` followed by names')
    .option('-f, --format <format>', 'Format to remove (svg, nextjs, nuxtjs — svg is icons only)')
    .option('-d, --dir <dir>', 'Custom directory the items were saved to')
    .addHelpText('after', `
${chalk.blue.bold('Examples:')}
  $ pphat remove icon react vue
  $ pphat remove icon react -f svg -d public/icons
  $ pphat remove component button card
  $ pphat remove component modal -f nextjs
`)
    .action(async (items: string[], options: RemoveParentOptions) => {
        if (!items || items.length === 0) {
            console.error(chalk.red('Nothing to remove. Try `pphat remove icon <names...>` or `pphat remove component <names...>`.'));
            process.exit(1);
        }

        const first = items[0].toLowerCase();
        if (first === 'icon' || first === 'icons') {
            return runRemoveIcons(items.slice(1), options);
        }
        if (first === 'component' || first === 'components' || first === 'comp') {
            return runRemoveComponents(items.slice(1), options);
        }
        console.error(chalk.red(`Unknown target "${items[0]}". Expected \`icon\` or \`component\`.`));
        console.error(chalk.yellow('Usage: pphat remove icon <names...>   or   pphat remove component <names...>'));
        process.exit(1);
    });
