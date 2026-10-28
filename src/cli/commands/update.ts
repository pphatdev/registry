import { Command } from 'commander';
import chalk from 'chalk';

import { runUpdateSkills } from './update-skills';

interface UpdateParentOptions {
    dir?: string;
    global?: boolean;
}

/**
* Update Command
* @description Parent command for updating skills (`pphat update skill [names...]`)
*/
export const updateCommand = new Command('update')
    .description('Update previously installed skills (grammar: `update skill [names...]`)')
    .argument('[items...]', '`skill` followed by names, or omit names to update all')
    .option('-d, --dir <dir>', 'Custom target directory where skills are installed')
    .option('-g, --global', 'Update globally installed skills in ~/.agent/skills')
    .addHelpText('after', `
${chalk.blue.bold('Examples:')}
  $ pphat update skill pphatdev/skills
  $ pphat update skill pphatdev/skills pphatdev/skills2
  $ pphat update skill                 ${chalk.dim('# updates all installed skills')}
`)
    .action(async (items: string[], options: UpdateParentOptions) => {
        if (!items || items.length === 0) {
            console.error(chalk.red('Nothing to update. Try `pphat update skill [names...]`.'));
            process.exit(1);
        }

        const first = items[0].toLowerCase();
        if (first === 'skill' || first === 'skills') {
            return runUpdateSkills(items.slice(1), options);
        }

        console.error(chalk.red(`Unknown target "${items[0]}". Expected \`skill\`.`));
        console.error(chalk.yellow('Usage: pphat update skill [names...]'));
        process.exit(1);
    });

