import readline from 'readline';
import chalk from 'chalk';

export interface SearchMultiselectOption {
    value: string;
    label: string;
    description?: string;
    hint?: string;
}

export interface SearchMultiselectConfig {
    message: string;
    options: SearchMultiselectOption[];
    initialValues?: string[];
    maxVisible?: number;
    showSelectAll?: boolean;
    isAgentSelection?: boolean;
}

/**
 * Search Multiselect Prompt
 * @description Renders an interactive terminal prompt with real-time text search,
 * circle checkboxes (○ / ●), space-to-toggle, select-all, and live description panel.
 * @param config Configuration options for the prompt
 * @returns Promise resolving to an array of selected option values
 */
export async function searchMultiselect(config: SearchMultiselectConfig): Promise<string[]> {
    const {
        message,
        options,
        initialValues = [],
        maxVisible = 12,
        showSelectAll = true,
        isAgentSelection = false,
    } = config;

    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        return initialValues.length > 0 ? initialValues : options.map(o => o.value);
    }

    return new Promise<string[]>((resolve) => {
        const selected = new Set<string>(initialValues);
        let query = '';
        let cursor = 0;
        let scrollOffset = 0;
        let lastLinesCount = 0;

        function getFiltered(): SearchMultiselectOption[] {
            const q = query.trim().toLowerCase();
            if (!q) return options;
            return options.filter(o => o.label.toLowerCase().includes(q));
        }

        function calculateRows(lines: string[]): number {
            const cols = process.stdout.columns || 80;
            let rows = 0;
            for (const line of lines) {
                const stripped = line.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
                rows += Math.max(1, Math.ceil(stripped.length / cols));
            }
            return rows;
        }

        function erase(rows: number) {
            if (rows > 0) {
                process.stdout.write(('\x1B[1A\x1B[2K').repeat(rows) + '\x1B[G\x1B[J');
            }
        }

        function render() {
            const filtered = getFiltered();
            const totalItems = (showSelectAll ? 1 : 0) + filtered.length;

            if (cursor >= totalItems) {
                cursor = Math.max(0, totalItems - 1);
            }

            // Adjust scroll offset
            const activeFilteredIdx = showSelectAll ? cursor - 1 : cursor;
            if (activeFilteredIdx >= 0) {
                if (activeFilteredIdx < scrollOffset) {
                    scrollOffset = activeFilteredIdx;
                } else if (activeFilteredIdx >= scrollOffset + maxVisible) {
                    scrollOffset = activeFilteredIdx - maxVisible + 1;
                }
            } else {
                scrollOffset = 0;
            }

            // Erase previous lines completely
            if (lastLinesCount > 0) {
                erase(lastLinesCount);
            }

            const lines: string[] = [];

            // Header
            if (isAgentSelection) {
                lines.push(chalk.gray('│') + '  ' + chalk.dim.bold('── Additional agents ─────────────────────────────'));
            } else {
                lines.push(chalk.cyan('◆') + '  ' + chalk.bold(message));
            }
            lines.push(chalk.gray('│') + '  ' + chalk.bold('Search: ') + (query ? chalk.white(query) : chalk.dim('')));
            lines.push(chalk.gray('│') + '  ' + chalk.dim('↑↓ move, space select, enter confirm'));
            lines.push(chalk.gray('│'));

            // Select All option
            if (showSelectAll) {
                const isAllSelected = filtered.length > 0 && filtered.every(o => selected.has(o.value));
                const pointer = cursor === 0 ? chalk.cyan('❯') : ' ';
                const circle = isAllSelected ? chalk.green('●') : chalk.gray('○');
                const labelText = `Select All (${selected.size}/${options.length})`;
                const label = cursor === 0 ? chalk.cyan(labelText) : labelText;
                lines.push(chalk.gray('│') + ' ' + pointer + ' ' + circle + ' ' + label);
                lines.push(chalk.gray('│') + '   ' + chalk.dim('────────────────────────────────────'));
            }

            // Filtered items (paginated)
            const visible = filtered.slice(scrollOffset, scrollOffset + maxVisible);

            if (filtered.length === 0) {
                lines.push(chalk.gray('│') + '   ' + chalk.dim('No matching skills found'));
            } else {
                for (let i = 0; i < visible.length; i++) {
                    const item = visible[i];
                    const itemCursor = (showSelectAll ? 1 : 0) + scrollOffset + i;
                    const isFocused = cursor === itemCursor;
                    const isChecked = selected.has(item.value);
                    const pointer = isFocused ? chalk.cyan('❯') : ' ';
                    const circle = isChecked ? chalk.green('●') : chalk.gray('○');
                    let labelText = item.label;
                    if (item.hint) {
                        labelText += chalk.dim(` (${item.hint})`);
                    }
                    const label = isFocused ? chalk.cyan(labelText) : isChecked ? labelText : chalk.dim(labelText);
                    lines.push(chalk.gray('│') + ' ' + pointer + ' ' + circle + ' ' + label);
                }
            }

            // More items indicator
            const remainingBelow = filtered.length - (scrollOffset + maxVisible);
            if (remainingBelow > 0) {
                lines.push(chalk.gray('│') + '  ' + chalk.dim(`↓ ${remainingBelow} more`));
            }

            // Footer
            if (isAgentSelection) {
                lines.push(chalk.gray('│'));
                const selectedLabels = options.filter(o => selected.has(o.value)).map(o => o.label.split(' (')[0]);
                const summaryStr = selectedLabels.length <= 3
                    ? selectedLabels.join(', ')
                    : `${selectedLabels.slice(0, 3).join(', ')} +${selectedLabels.length - 3} more`;
                lines.push(chalk.gray('│') + '  ' + chalk.dim('Selected: ') + (selectedLabels.length > 0 ? chalk.white(summaryStr) : chalk.dim('none')));
            } else {
                lines.push(chalk.gray('│'));
                lines.push(chalk.gray('│') + '  ' + chalk.bold('Description'));
                let desc = '';
                if (cursor === 0 && showSelectAll) {
                    desc = `Select or clear all ${options.length} skills.`;
                } else {
                    const focusedIdx = cursor - (showSelectAll ? 1 : 0);
                    const focusedItem = filtered[focusedIdx];
                    desc = focusedItem?.description || 'No description available.';
                }
                lines.push(chalk.gray('│') + '  ' + chalk.dim(desc));
            }

            process.stdout.write(lines.join('\n') + '\n');
            lastLinesCount = calculateRows(lines);
        }

        // Hide cursor
        process.stdout.write('\x1B[?25l');

        const stdin = process.stdin;
        stdin.setRawMode(true);
        stdin.resume();
        readline.emitKeypressEvents(stdin);

        render();

        function cleanup() {
            stdin.removeListener('keypress', onKeypress);
            stdin.setRawMode(false);
            process.stdout.write('\x1B[?25h'); // show cursor
        }

        function onKeypress(str: string, key: readline.Key) {
            if (!key) return;

            // Ctrl+C / Escape
            if ((key.ctrl && key.name === 'c') || key.name === 'escape') {
                cleanup();
                if (lastLinesCount > 0) {
                    erase(lastLinesCount);
                }
                console.log(chalk.red('\nOperation cancelled.'));
                process.exit(0);
            }

            // Enter / Return -> Confirm
            if (key.name === 'return' || key.name === 'enter') {
                cleanup();
                if (lastLinesCount > 0) {
                    erase(lastLinesCount);
                }

                // Render submitted state
                if (isAgentSelection) {
                    console.log(chalk.green('◇') + '  ' + chalk.bold('Additional agents'));
                    const names = options.filter(o => selected.has(o.value)).map(o => o.label.split(' (')[0]);
                    const summary = names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} +${names.length - 3} more`;
                    console.log(chalk.gray('│') + '  ' + (names.length > 0 ? summary : 'None'));
                    console.log(chalk.gray('│'));
                } else {
                    console.log(chalk.green('◇') + '  ' + chalk.bold(message));
                    const chosen = options.filter(o => selected.has(o.value)).map(o => o.label);
                    console.log(chalk.gray('│') + '  ' + chalk.dim(`Selected ${chosen.length} skill(s): ${chosen.join(', ')}`));
                    console.log(chalk.gray('│'));
                }

                resolve(Array.from(selected));
                return;
            }

            // Up arrow
            if (key.name === 'up') {
                const total = (showSelectAll ? 1 : 0) + getFiltered().length;
                if (total > 0) {
                    cursor = cursor > 0 ? cursor - 1 : total - 1;
                }
                render();
                return;
            }

            // Down arrow
            if (key.name === 'down') {
                const total = (showSelectAll ? 1 : 0) + getFiltered().length;
                if (total > 0) {
                    cursor = cursor < total - 1 ? cursor + 1 : 0;
                }
                render();
                return;
            }

            // Spacebar -> Toggle Checkbox!
            if (key.name === 'space') {
                const filtered = getFiltered();
                if (showSelectAll && cursor === 0) {
                    // Toggle all filtered
                    const allSelected = filtered.length > 0 && filtered.every(o => selected.has(o.value));
                    if (allSelected) {
                        for (const o of filtered) selected.delete(o.value);
                    } else {
                        for (const o of filtered) selected.add(o.value);
                    }
                } else {
                    const idx = cursor - (showSelectAll ? 1 : 0);
                    const item = filtered[idx];
                    if (item) {
                        if (selected.has(item.value)) {
                            selected.delete(item.value);
                        } else {
                            selected.add(item.value);
                        }
                    }
                }
                render();
                return;
            }

            // Backspace
            if (key.name === 'backspace') {
                if (query.length > 0) {
                    query = query.slice(0, -1);
                    cursor = 0;
                    scrollOffset = 0;
                    render();
                }
                return;
            }

            // Printable character -> Filter by typing!
            if (str && str.length === 1 && !key.ctrl && !key.meta && str >= ' ') {
                query += str;
                cursor = 0;
                scrollOffset = 0;
                render();
            }
        }

        stdin.on('keypress', onKeypress);
    });
}

