import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { createHash } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getConfig } from './config';

const execFileAsync = promisify(execFile);

export const SKILLS_MANIFEST_FILE = '.skills.json';
export const SKILLS_LOCK_FILE = 'skills-lock.json';

export interface ParsedSkillSource {
    raw: string;
    repoUrl: string;
    repoName: string;
    ref?: string;
    subpath?: string;
    isLocal: boolean;
}

export interface InstalledSkillItem {
    name: string;
    dir: string;
    description?: string;
}

export interface SkillManifestEntry {
    source: string;
    url: string;
    ref?: string;
    targetDir: string;
    installedAt: string;
    updatedAt: string;
    skills: InstalledSkillItem[];
}

export interface SkillsManifest {
    skills: Record<string, SkillManifestEntry>;
}

export interface SkillLockEntry {
    source: string;
    sourceType: 'github' | 'git' | 'local' | string;
    skillPath?: string;
    computedHash: string;
}

export interface SkillsLockFile {
    version: number;
    skills: Record<string, SkillLockEntry>;
}

export interface DiscoveredSkill {
    name: string;
    sourceDir: string;
    description?: string;
    skillPath?: string;
}

export interface AgentDefinition {
    id: string;
    name: string;
    projectDir: string;
    globalDir: string;
}

export const SUPPORTED_AGENTS: AgentDefinition[] = [
    { id: 'agent', name: 'Universal Agent (.agent/skills)', projectDir: '.agent/skills', globalDir: '.agent/skills' },
    { id: 'aider-desk', name: 'AiderDesk', projectDir: '.aider-desk/skills', globalDir: '.aider-desk/skills' },
    { id: 'amp', name: 'Amp', projectDir: '.amp/skills', globalDir: '.amp/skills' },
    { id: 'augment', name: 'Augment', projectDir: '.augment/skills', globalDir: '.augment/skills' },
    { id: 'autohand', name: 'Autohand Code CLI', projectDir: '.autohand/skills', globalDir: '.autohand/skills' },
    { id: 'bob', name: 'IBM Bob', projectDir: '.bob/skills', globalDir: '.bob/skills' },
    { id: 'claude', name: 'Claude Code', projectDir: '.claude/skills', globalDir: '.claude/skills' },
    { id: 'cline', name: 'Cline', projectDir: '.cline/skills', globalDir: '.cline/skills' },
    { id: 'codearts', name: 'CodeArts Agent', projectDir: '.codeartsdoer/skills', globalDir: '.codeartsdoer/skills' },
    { id: 'codex', name: 'Codex', projectDir: '.codex/skills', globalDir: '.codex/skills' },
    { id: 'copilot', name: 'GitHub Copilot', projectDir: '.github/skills', globalDir: '.github/skills' },
    { id: 'cursor', name: 'Cursor', projectDir: '.cursor/skills', globalDir: '.cursor/skills' },
    { id: 'droid', name: 'Droid', projectDir: '.droid/skills', globalDir: '.droid/skills' },
    { id: 'gemini', name: 'Gemini CLI', projectDir: '.gemini/skills', globalDir: '.gemini/skills' },
    { id: 'openclaw', name: 'OpenClaw', projectDir: 'skills', globalDir: 'skills' },
    { id: 'opencode', name: 'OpenCode', projectDir: '.opencode/skills', globalDir: '.opencode/skills' },
    { id: 'roo', name: 'Roo Code', projectDir: '.roo/skills', globalDir: '.roo/skills' },
    { id: 'windsurf', name: 'Windsurf', projectDir: '.windsurf/skills', globalDir: '.windsurf/skills' },
    { id: 'zed', name: 'Zed', projectDir: '.zed/skills', globalDir: '.zed/skills' },
];

/**
 * Detect Project Agents
 * @description Scans workspace directory to detect which coding agents are configured
 * @param cwd Workspace directory to check
 * @returns Array of detected agent IDs
 */
export function detectProjectAgents(cwd: string = process.cwd()): string[] {
    const detected: string[] = ['agent'];
    for (const agent of SUPPORTED_AGENTS) {
        if (agent.id === 'agent') continue;
        if (agent.id === 'copilot') {
            if (existsSync(path.join(cwd, '.github', 'skills')) || existsSync(path.join(cwd, '.github', 'copilot-instructions.md'))) {
                detected.push(agent.id);
            }
            continue;
        }
        const dirName = agent.projectDir.split('/')[0];
        if (existsSync(path.join(cwd, dirName))) {
            if (!detected.includes(agent.id)) {
                detected.push(agent.id);
            }
        }
    }
    return detected;
}

/**
* Resolve Agent Skill Directories
* @description Returns target paths for specified agent IDs
* @param agentIds Selected agent identifiers
* @param isGlobal Whether to resolve to user home global directories
* @param cwd Current working directory
* @returns List of resolved target directories
*/
export function resolveAgentDirs(agentIds: string[], isGlobal: boolean = false, cwd: string = process.cwd()): string[] {
    const dirs: string[] = [];
    for (const id of agentIds) {
        const normalized = id.toLowerCase().replace(/[-_]/g, '');
        const found = SUPPORTED_AGENTS.find(
            a => a.id.toLowerCase() === normalized || a.id.toLowerCase() === id.toLowerCase()
        );
        if (found) {
            const rel = isGlobal ? found.globalDir : found.projectDir;
            const target = isGlobal ? path.join(os.homedir(), rel) : path.join(cwd, rel);
            if (!dirs.includes(target)) dirs.push(target);
        }
    }
    if (dirs.length === 0) {
        const fallback = isGlobal ? path.join(os.homedir(), '.agent/skills') : path.join(cwd, '.agent/skills');
        dirs.push(fallback);
    }
    return dirs;
}

/**
* Parse Skill Source
* @description Parses a skill source string (repo shorthand, git URL, or local path) into structured components
* @param source The raw skill source string
* @returns The parsed skill source object
*/
export function parseSkillSource(source: string): ParsedSkillSource {
    const raw = source.trim();

    // Check for local file path
    if (
        raw.startsWith('.') ||
        raw.startsWith('/') ||
        raw.startsWith('~') ||
        (process.platform === 'win32' && /^[a-zA-Z]:/.test(raw))
    ) {
        const resolvedPath = raw.startsWith('~')
            ? path.join(os.homedir(), raw.slice(1))
            : path.resolve(process.cwd(), raw);
        const repoName = path.basename(resolvedPath);
        return {
            raw,
            repoUrl: resolvedPath,
            repoName,
            isLocal: true
        };
    }

    // Check for GitHub tree URL: https://github.com/owner/repo/tree/branch/path...
    const treeMatch = raw.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/);
    if (treeMatch) {
        const [, owner, repo, ref, subpath] = treeMatch;
        const cleanRepo = repo.replace(/\.git$/, '');
        return {
            raw,
            repoUrl: `https://github.com/${owner}/${cleanRepo}.git`,
            repoName: cleanRepo,
            ref,
            subpath,
            isLocal: false
        };
    }

    // Check for Git or HTTP URL
    if (raw.startsWith('git@') || raw.startsWith('https://') || raw.startsWith('http://')) {
        let repoUrl = raw;
        let ref: string | undefined;

        if (repoUrl.includes('#')) {
            const [url, branch] = repoUrl.split('#');
            repoUrl = url;
            ref = branch;
        }

        const match = repoUrl.match(/\/([^/]+?)(?:\.git)?$/);
        const repoName = match ? match[1] : 'skill-repo';

        return {
            raw,
            repoUrl,
            repoName,
            ref,
            isLocal: false
        };
    }

    // Default: owner/repo shorthand (with optional #ref and subpath)
    let spec = raw;
    let ref: string | undefined;
    if (spec.includes('#')) {
        const [left, branch] = spec.split('#');
        spec = left;
        ref = branch;
    }

    const segments = spec.split('/');
    if (segments.length >= 2) {
        const owner = segments[0];
        const repo = segments[1];
        const subpath = segments.length > 2 ? segments.slice(2).join('/') : undefined;
        return {
            raw,
            repoUrl: `https://github.com/${owner}/${repo}.git`,
            repoName: repo,
            ref,
            subpath,
            isLocal: false
        };
    }

    // Fallback: single name treated as repository under github or local name
    return {
        raw,
        repoUrl: `https://github.com/${raw}.git`,
        repoName: raw,
        ref,
        isLocal: false
    };
}

/**
* Resolve Target Directory for Skills
* @description Determines where skills should be installed based on CLI options, config, or directory presence
* @param options Directory overrides or global install flag
* @returns Absolute path to target skills directory
*/
export async function getSkillsTargetDir(options?: { dir?: string; global?: boolean }): Promise<string> {
    const cwd = process.cwd();

    if (options?.global) {
        return path.join(os.homedir(), '.agent', 'skills');
    }

    if (options?.dir) {
        return path.resolve(cwd, options.dir);
    }

    const config = await getConfig();
    if (config.skills?.dir) {
        return path.resolve(cwd, config.skills.dir);
    }

    // Auto-detect project structure conventions
    if (existsSync(path.join(cwd, '.agent', 'skills'))) {
        return path.join(cwd, '.agent', 'skills');
    }
    if (existsSync(path.join(cwd, '.agents', 'skills'))) {
        return path.join(cwd, '.agents', 'skills');
    }
    if (existsSync(path.join(cwd, 'skills'))) {
        return path.join(cwd, 'skills');
    }
    if (existsSync(path.join(cwd, '.claude', 'skills'))) {
        return path.join(cwd, '.claude', 'skills');
    }

    return path.join(cwd, '.agent', 'skills');
}

/**
* Load Skills Manifest
* @description Reads and parses the .skills.json manifest file if available
* @param cwd Target directory containing the manifest
* @returns The parsed SkillsManifest object
*/
export async function loadSkillsManifest(cwd: string = process.cwd()): Promise<SkillsManifest> {
    const manifestPath = path.join(cwd, SKILLS_MANIFEST_FILE);
    if (!existsSync(manifestPath)) {
        return { skills: {} };
    }

    try {
        const content = await fs.readFile(manifestPath, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed.skills === 'object') {
            return parsed as SkillsManifest;
        }
        return { skills: {} };
    } catch {
        return { skills: {} };
    }
}

/**
* Save Skills Manifest
* @description Persists the skills manifest to .skills.json
* @param manifest The manifest data to write
* @param cwd Target directory for the manifest
* @returns Promise resolving when write completes
*/
export async function saveSkillsManifest(manifest: SkillsManifest, cwd: string = process.cwd()): Promise<void> {
    const manifestPath = path.join(cwd, SKILLS_MANIFEST_FILE);
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

/**
 * Load Skills Lock
 * @description Reads and parses skills-lock.json if available
 * @param cwd Target directory containing the lockfile
 * @returns The parsed SkillsLockFile object
 */
export async function loadSkillsLock(cwd: string = process.cwd()): Promise<SkillsLockFile> {
    const lockPath = path.join(cwd, SKILLS_LOCK_FILE);
    if (!existsSync(lockPath)) {
        return { version: 1, skills: {} };
    }

    try {
        const content = await fs.readFile(lockPath, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed.skills === 'object') {
            return {
                version: parsed.version || 1,
                skills: parsed.skills
            };
        }
        return { version: 1, skills: {} };
    } catch {
        return { version: 1, skills: {} };
    }
}

/**
 * Save Skills Lock
 * @description Persists skills to skills-lock.json with sorted keys and 2-space indentation
 * @param lock The lock data to write
 * @param cwd Target directory for the lockfile
 * @returns Promise resolving when write completes
 */
export async function saveSkillsLock(lock: SkillsLockFile, cwd: string = process.cwd()): Promise<void> {
    const lockPath = path.join(cwd, SKILLS_LOCK_FILE);
    const sortedSkills: Record<string, SkillLockEntry> = {};
    for (const key of Object.keys(lock.skills).sort()) {
        sortedSkills[key] = lock.skills[key];
    }
    const data: SkillsLockFile = {
        version: lock.version || 1,
        skills: sortedSkills
    };
    await fs.writeFile(lockPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/**
 * Compute Skill Folder Hash
 * @description Recursively collects all files in a skill directory, sorts them deterministically,
 * and generates a SHA-256 hash of their relative paths and contents (matching skills.sh standard).
 * @param skillDir Absolute or relative path to the skill directory
 * @returns SHA-256 hex string digest
 */
export async function computeSkillFolderHash(skillDir: string): Promise<string> {
    const files: Array<{ relativePath: string; content: Buffer }> = [];

    async function collect(dir: string, base: string) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const rel = path.relative(base, fullPath).replace(/\\/g, '/');
            if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.DS_Store') {
                continue;
            }
            if (entry.isDirectory()) {
                await collect(fullPath, base);
            } else if (entry.isFile()) {
                const content = await fs.readFile(fullPath);
                files.push({ relativePath: rel, content });
            }
        }
    }

    if (existsSync(skillDir)) {
        const stat = await fs.stat(skillDir);
        if (stat.isDirectory()) {
            await collect(skillDir, skillDir);
        } else if (stat.isFile()) {
            const content = await fs.readFile(skillDir);
            files.push({ relativePath: path.basename(skillDir), content });
        }
    }

    // Sort by relative path for deterministic hashing
    files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    const hash = createHash('sha256');
    for (const file of files) {
        hash.update(file.relativePath);
        hash.update(file.content);
    }

    return hash.digest('hex');
}

/**
 * Get Source Type
 * @description Determines whether a parsed skill source is github, git, or local
 * @param parsed The parsed skill source
 * @returns 'github' | 'git' | 'local'
 */
export function getSourceType(parsed: ParsedSkillSource): 'github' | 'git' | 'local' {
    if (parsed.isLocal) return 'local';
    if (
        parsed.repoUrl.includes('github.com') ||
        (!parsed.raw.startsWith('git@') && !parsed.raw.startsWith('http') && parsed.raw.includes('/'))
    ) {
        return 'github';
    }
    return 'git';
}

/**
* Parse Frontmatter from Markdown
* @description Extracts name and description YAML frontmatter from a markdown string
* @param content Markdown file content
* @returns Extracted metadata properties
*/
export function parseSkillFrontmatter(content: string): { name?: string; description?: string } {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return {};

    const frontmatter = match[1];
    let name: string | undefined;
    let description: string | undefined;

    const nameMatch = frontmatter.match(/^name:\s*["']?([^"'\r\n]+)["']?/m);
    if (nameMatch) {
        name = nameMatch[1].trim();
    }

    const descMatch = frontmatter.match(/^description:\s*["']?([^"'\r\n]+)["']?/m);
    if (descMatch) {
        description = descMatch[1].trim();
    }

    return { name, description };
}

/**
* Clone or Fetch Skill Repository
* @description Clones a git repository or returns local path for skill inspection
* @param parsed The parsed skill source
* @returns Temp directory and cleanup callback
*/
export async function cloneOrFetchRepo(parsed: ParsedSkillSource): Promise<{ tempDir: string; cleanup: () => Promise<void> }> {
    if (parsed.isLocal) {
        if (!existsSync(parsed.repoUrl)) {
            throw new Error(`Local path "${parsed.repoUrl}" does not exist.`);
        }
        return {
            tempDir: parsed.repoUrl,
            cleanup: async () => {}
        };
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pphat-skill-'));

    const cleanup = async () => {
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch {
            // ignore cleanup errors
        }
    };

    try {
        const gitArgs = ['clone', '--depth', '1'];
        if (parsed.ref) {
            gitArgs.push('--branch', parsed.ref);
        }
        gitArgs.push(parsed.repoUrl, tempDir);

        await execFileAsync('git', gitArgs);
        return { tempDir, cleanup };
    } catch (err: any) {
        // If cloning with branch failed, try cloning default branch then checkout ref
        if (parsed.ref) {
            try {
                await execFileAsync('git', ['clone', '--depth', '1', parsed.repoUrl, tempDir]);
                await execFileAsync('git', ['checkout', parsed.ref], { cwd: tempDir });
                return { tempDir, cleanup };
            } catch {
                await cleanup();
                throw new Error(`Failed to clone git repository "${parsed.repoUrl}": ${err.message || err}`);
            }
        }
        await cleanup();
        throw new Error(`Failed to clone git repository "${parsed.repoUrl}": ${err.message || err}`);
    }
}

/**
* Discover Skills within a Repository
* @description Finds skill folders containing SKILL.md within a cloned or local repository
* @param repoDir Root directory of the repository
* @param subpath Optional specific subpath to inspect
* @param fallbackName Fallback skill name if no frontmatter is found
* @returns Array of discovered skills
*/
export async function discoverSkills(
    repoDir: string,
    subpath?: string,
    fallbackName: string = 'skill'
): Promise<DiscoveredSkill[]> {
    // 1. Explicit subpath targeted
    if (subpath) {
        const targetPath = path.join(repoDir, subpath);
        if (existsSync(targetPath)) {
            const skillMd = path.join(targetPath, 'SKILL.md');
            let name = path.basename(subpath);
            let description: string | undefined;

            if (existsSync(skillMd)) {
                try {
                    const content = await fs.readFile(skillMd, 'utf-8');
                    const fm = parseSkillFrontmatter(content);
                    if (fm.name) name = fm.name;
                    description = fm.description;
                } catch {
                    // ignore read error
                }
            }
            const relSkillMd = existsSync(skillMd)
                ? path.relative(repoDir, skillMd).replace(/\\/g, '/')
                : path.relative(repoDir, targetPath).replace(/\\/g, '/');
            return [{ name, sourceDir: targetPath, description, skillPath: relSkillMd }];
        }
    }

    const discovered: DiscoveredSkill[] = [];

    // 2. Candidate skill container directories: skills/, .agent/skills/, .agents/skills/
    const candidateDirs = ['skills', path.join('.agent', 'skills'), path.join('.agents', 'skills')];
    for (const cand of candidateDirs) {
        const candPath = path.join(repoDir, cand);
        if (existsSync(candPath)) {
            const entries = await fs.readdir(candPath, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory() && !entry.name.startsWith('.')) {
                    const skillDir = path.join(candPath, entry.name);
                    const skillMd = path.join(skillDir, 'SKILL.md');
                    let name = entry.name;
                    let description: string | undefined;

                    if (existsSync(skillMd)) {
                        try {
                            const content = await fs.readFile(skillMd, 'utf-8');
                            const fm = parseSkillFrontmatter(content);
                            if (fm.name) name = fm.name;
                            description = fm.description;
                        } catch {
                            // ignore read error
                        }
                        const relSkillMd = path.relative(repoDir, skillMd).replace(/\\/g, '/');
                        discovered.push({ name, sourceDir: skillDir, description, skillPath: relSkillMd });
                    }
                }
            }
            if (discovered.length > 0) {
                return discovered;
            }
        }
    }

    // 3. Top-level subdirectories containing SKILL.md
    try {
        const topEntries = await fs.readdir(repoDir, { withFileTypes: true });
        for (const entry of topEntries) {
            if (
                entry.isDirectory() &&
                !entry.name.startsWith('.') &&
                entry.name !== 'node_modules' &&
                entry.name !== 'dist' &&
                entry.name !== 'bin'
            ) {
                const subDir = path.join(repoDir, entry.name);
                const skillMd = path.join(subDir, 'SKILL.md');
                if (existsSync(skillMd)) {
                    let name = entry.name;
                    let description: string | undefined;
                    try {
                        const content = await fs.readFile(skillMd, 'utf-8');
                        const fm = parseSkillFrontmatter(content);
                        if (fm.name) name = fm.name;
                        description = fm.description;
                    } catch {
                        // ignore
                    }
                    const relSkillMd = path.relative(repoDir, skillMd).replace(/\\/g, '/');
                    discovered.push({ name, sourceDir: subDir, description, skillPath: relSkillMd });
                }
            }
        }
    } catch {
        // ignore read dir error
    }

    if (discovered.length > 0) {
        return discovered;
    }

    // 4. Root level single skill (SKILL.md at root)
    const rootSkillMd = path.join(repoDir, 'SKILL.md');
    if (existsSync(rootSkillMd)) {
        let name = fallbackName;
        let description: string | undefined;
        try {
            const content = await fs.readFile(rootSkillMd, 'utf-8');
            const fm = parseSkillFrontmatter(content);
            if (fm.name) name = fm.name;
            description = fm.description;
        } catch {
            // ignore
        }
        return [{ name, sourceDir: repoDir, description, skillPath: 'SKILL.md' }];
    }

    // 5. Fallback: Entire repo treated as skill
    return [{ name: fallbackName, sourceDir: repoDir, skillPath: '.' }];
}

/**
* Install Skill Files
* @description Copies skill files from source directory to destination skills directory
* @param sourceDir Source directory of the skill
* @param targetSkillsDir Destination parent skills folder
* @param skillName Name of the skill directory
* @returns The destination directory path
*/
export async function installSkill(
    sourceDir: string,
    targetSkillsDir: string,
    skillName: string
): Promise<string> {
    const destDir = path.join(targetSkillsDir, skillName);

    if (!existsSync(targetSkillsDir)) {
        await fs.mkdir(targetSkillsDir, { recursive: true });
    }

    // Clean existing skill folder if present
    if (existsSync(destDir)) {
        await fs.rm(destDir, { recursive: true, force: true });
    }

    await fs.mkdir(destDir, { recursive: true });

    // Copy files recursively, skipping .git, node_modules, and OS junk
    await fs.cp(sourceDir, destDir, {
        recursive: true,
        filter: (src) => {
            const base = path.basename(src);
            if (base === '.git' || base === 'node_modules' || base === '.DS_Store') {
                return false;
            }
            return true;
        }
    });

    return destDir;
}

export interface SkillSearchResult {
    name: string;
    description?: string;
    source: string;
    url?: string;
    installs?: number;
    stars?: number;
}

/**
* Search Online Skills Registry
* @description Searches the skills registry and GitHub for available AI agent skills matching query
* @param query Search keywords
* @returns List of matching skill results
*/
export async function searchSkills(query: string = ''): Promise<SkillSearchResult[]> {
    const q = query.trim().toLowerCase();
    const results: SkillSearchResult[] = [];

    // 1. Try skills.sh API
    try {
        const searchUrl = q ? `https://skills.sh/api/search?q=${encodeURIComponent(q)}` : `https://skills.sh/api/search`;
        const res = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'pphat-cli',
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(3000)
        });

        if (res.ok) {
            const data: any = await res.json();
            const items = Array.isArray(data) ? data : data.skills || data.items || [];
            for (const item of items) {
                const name = item.name || item.id || item.title;
                const source = item.source || (item.owner && item.repo ? `${item.owner}/${item.repo}` : item.repository || name);
                results.push({
                    name,
                    description: item.description,
                    source,
                    url: item.url || (source.includes('/') ? `https://github.com/${source}` : undefined),
                    installs: item.installs || item.downloads,
                    stars: item.stars
                });
            }
        }
    } catch {
        // Fallback gracefully on network/endpoint error
    }

    // 2. If results are few and we have a query, search GitHub API for relevant skill repositories
    if (results.length < 5 && q) {
        try {
            const ghUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}+in:name,description&per_page=10`;
            const ghRes = await fetch(ghUrl, {
                headers: {
                    'User-Agent': 'pphat-cli',
                    'Accept': 'application/vnd.github.v3+json'
                },
                signal: AbortSignal.timeout(3000)
            });

            if (ghRes.ok) {
                const ghData: any = await ghRes.json();
                if (Array.isArray(ghData.items)) {
                    for (const repo of ghData.items) {
                        const fullName = repo.full_name;
                        if (!results.some(r => r.source.toLowerCase() === fullName.toLowerCase())) {
                            results.push({
                                name: repo.name,
                                description: repo.description,
                                source: fullName,
                                url: repo.html_url,
                                stars: repo.stargazers_count
                            });
                        }
                    }
                }
            }
        } catch {
            // Ignore API rate-limits or offline errors
        }
    }

    return results;
}

/**
* Remove Skill Files
* @description Deletes a skill folder from disk
* @param skillPath Absolute path of skill directory to remove
* @returns Boolean indicating whether deletion took place
*/
export async function removeSkillFiles(skillPath: string): Promise<boolean> {
    if (existsSync(skillPath)) {
        await fs.rm(skillPath, { recursive: true, force: true });
        return true;
    }
    return false;
}

