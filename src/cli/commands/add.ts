import { Command } from 'commander';
import chalk from 'chalk';

import { runAddIcons } from './add-icons';
import { runAddComponents } from './add-components';

interface AddParentOptions {
    format?: 'nextjs' | 'nuxtjs' | 'svg';
    dir?: string;
}

/**
* `pphat add ...` — parent command with three forms:
*   pphat add icon <names...>      → runAddIcons
*   pphat add component <names...> → runAddComponents
*   pphat add <names...>           → runAddIcons (legacy; the original `add` alias behaviour)
*/
export const addCommand = new Command('add')
    .description('Add icons or components to your project (grammar: `add icon <names...>` or `add component <names...>`)')
    .argument('[items...]', 'Either `icon`/`component` followed by names, or just icon names (legacy shortcut)')
    .option('-f, --format <format>', 'Override format (svg, nextjs, nuxtjs — svg is icons only)')
    .option('-d, --dir <dir>', 'Custom target directory to save downloaded items')
    .addHelpText('after', `
${chalk.blue.bold('Examples:')}
  $ pphat add icon react vue github
  $ pphat add icon react -f svg -d public/icons
  $ pphat add component button card
  $ pphat add component modal -f nextjs
  $ pphat add react vue                ${chalk.dim('# legacy: same as `add icon react vue`')}
`)
    .action(async (items: string[], options: AddParentOptions) => {
        if (!items || items.length === 0) {
            console.error(chalk.red('Nothing to add. Try `pphat add icon <names...>` or `pphat add component <names...>`.'));
            process.exit(1);
        }

        const first = items[0].toLowerCase();
        if (first === 'icon' || first === 'icons') {
            return runAddIcons(items.slice(1), options);
        }
        if (first === 'component' || first === 'components' || first === 'comp') {
            return runAddComponents(items.slice(1), options);
        }
        // Legacy: `pphat add react vue` == `pphat add icon react vue`
        return runAddIcons(items, options);
    });
