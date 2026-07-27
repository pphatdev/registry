import fs from 'fs/promises';
import { existsSync } from 'fs';
import { Command } from 'commander';
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { HISTORY_FILE, RunEvent, fetchPopular, resetRemote } from '../../core/telemetry';

async function readHistory(): Promise<RunEvent[]> {
    if (!existsSync(HISTORY_FILE)) return [];
    const raw = await fs.readFile(HISTORY_FILE, 'utf-8');
    const events: RunEvent[] = [];
    for (const line of raw.split('\n')) {
        if (!line.trim()) continue;
        try {
            events.push(JSON.parse(line) as RunEvent);
        } catch {
            // skip malformed line
        }
    }
    return events;
}

function tally<T extends string | number>(items: T[]): [T, number][] {
    const map = new Map<T, number>();
    for (const item of items) map.set(item, (map.get(item) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function printTable(title: string, rows: [string, number][]): void {
    console.log(chalk.blue.bold(`\n${title}`));
    if (rows.length === 0) {
        console.log(chalk.dim('  (none)'));
        return;
    }
    const width = Math.max(...rows.map(([k]) => k.length));
    for (const [key, count] of rows) {
        console.log(`  ${chalk.green(key.padEnd(width))}  ${chalk.cyan(count)}`);
    }
}

const ICON_COMMANDS = new Set(['add-icon', 'add']);
const COMPONENT_COMMANDS = new Set(['add-component', 'add-comp']);
const VALUE_FLAGS = new Set(['-f', '--format', '-d', '--dir']);

function extractNames(args: string[]): string[] {
    const names: string[] = [];
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (!a) continue;
        if (a.startsWith('-')) {
            if (VALUE_FLAGS.has(a)) i++;
            continue;
        }
        names.push(a.toLowerCase());
    }
    return names;
}

function parseTopN(value: unknown, fallback = 10): number {
    if (value === true || value === undefined) return fallback;
    const n = parseInt(String(value), 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

interface StatsOptions {
    days?: number;
    clear?: boolean;
    topIcons?: boolean | string;
    topComponents?: boolean | string;
    remote?: boolean;
    resetRemote?: boolean;
    yes?: boolean;
}

export const statsCommand = new Command('stats')
    .description('Show CLI usage statistics from ~/.pphat/history.jsonl or the remote registry')
    .option('-n, --days <days>', 'Only include runs from the last N days', (v) => parseInt(v, 10))
    .option('--top-icons [n]', 'Show top N most-added icons (default 10)')
    .option('--top-components [n]', 'Show top N most-added components (default 10)')
    .option('--remote', 'Query the aggregated stats endpoint instead of local history')
    .option('--clear', 'Wipe your own local history file (personal, no auth)')
    .option('--reset-remote', 'ADMIN: wipe the aggregate remote store (requires PPHAT_ADMIN_TOKEN)')
    .option('-y, --yes', 'Skip the confirmation prompt for destructive actions')
    .addHelpText('after', `
${chalk.blue.bold('Examples:')}
  $ pphat stats
  $ pphat stats --days 7
  $ pphat stats --top-icons
  $ pphat stats --top-icons 5 --days 30
  $ pphat stats --top-components 20
  $ pphat stats --top-icons --remote
  $ pphat stats --clear                   ${chalk.dim('# personal: wipe ~/.pphat/history.jsonl')}
  $ PPHAT_ADMIN_TOKEN=… pphat stats --reset-remote   ${chalk.dim('# admin only')}
`)
    .action(async (opts: StatsOptions) => {
        if (opts.resetRemote) {
            if (!process.env.PPHAT_ADMIN_TOKEN) {
                console.error(chalk.red('PPHAT_ADMIN_TOKEN is not set. This action is admin-only.'));
                process.exit(1);
            }
            if (!opts.yes) {
                const ok = await confirm({
                    message: 'This will wipe the aggregate stats for ALL users. Continue?',
                    default: false,
                });
                if (!ok) {
                    console.log(chalk.yellow('Cancelled.'));
                    return;
                }
            }
            try {
                const result = await resetRemote();
                if (result === 'no-endpoint') {
                    console.error(chalk.red('No remote endpoint configured. Set PPHAT_TELEMETRY_ENDPOINT.'));
                    process.exit(1);
                }
                console.log(chalk.green('Remote stats reset.'));
            } catch (err) {
                console.error(chalk.red(err instanceof Error ? err.message : String(err)));
                process.exit(1);
            }
            return;
        }

        if (opts.clear) {
            if (existsSync(HISTORY_FILE)) await fs.rm(HISTORY_FILE);
            console.log(chalk.green('Local history cleared (personal only — remote is untouched).'));
            return;
        }

        const scope = opts.days ? ` (last ${opts.days} day${opts.days === 1 ? '' : 's'})` : '';

        if (opts.remote) {
            if (opts.topIcons === undefined && opts.topComponents === undefined) {
                console.error(chalk.red('--remote requires --top-icons or --top-components.'));
                process.exit(1);
            }
            if (opts.topIcons !== undefined) {
                const limit = parseTopN(opts.topIcons);
                const rows = await fetchPopular('icons', { days: opts.days, limit });
                if (rows === null) {
                    console.error(chalk.red('No remote endpoint configured. Set PPHAT_TELEMETRY_ENDPOINT.'));
                    process.exit(1);
                }
                printTable(`Top icons — all users${scope}:`, rows);
            }
            if (opts.topComponents !== undefined) {
                const limit = parseTopN(opts.topComponents);
                const rows = await fetchPopular('components', { days: opts.days, limit });
                if (rows === null) {
                    console.error(chalk.red('No remote endpoint configured. Set PPHAT_TELEMETRY_ENDPOINT.'));
                    process.exit(1);
                }
                printTable(`Top components — all users${scope}:`, rows);
            }
            console.log('');
            return;
        }

        let events = await readHistory();
        if (events.length === 0) {
            console.log(chalk.yellow('No history yet. Run a few commands and try again.'));
            return;
        }

        if (opts.days && opts.days > 0) {
            const cutoff = Date.now() - opts.days * 86_400_000;
            events = events.filter(e => new Date(e.ts).getTime() >= cutoff);
        }

        if (opts.topIcons !== undefined || opts.topComponents !== undefined) {
            if (opts.topIcons !== undefined) {
                const limit = parseTopN(opts.topIcons);
                const names = events
                    .filter(e => ICON_COMMANDS.has(e.command))
                    .flatMap(e => extractNames(e.args));
                printTable(`Top icons${scope}:`, tally(names).slice(0, limit));
            }
            if (opts.topComponents !== undefined) {
                const limit = parseTopN(opts.topComponents);
                const names = events
                    .filter(e => COMPONENT_COMMANDS.has(e.command))
                    .flatMap(e => extractNames(e.args));
                printTable(`Top components${scope}:`, tally(names).slice(0, limit));
            }
            console.log('');
            return;
        }

        const total = events.length;
        const successCount = events.filter(e => e.success).length;

        console.log(chalk.magenta.bold(`\nTotal runs${scope}: ${chalk.white(total)}`));
        console.log(chalk.dim(`  success: ${successCount}   failed: ${total - successCount}`));

        printTable('By alias:', tally(events.map(e => e.alias)));
        printTable('By command:', tally(events.map(e => e.command)));
        printTable('By day:', tally(events.map(e => e.ts.slice(0, 10))).slice(0, 14));
        console.log('');
    });
