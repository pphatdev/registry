# Release Notes — v1.5.0

**Release Tag:** `v1.5.0`  
**Date:** October 28, 2026  
**Package:** `@pphatdev/registry@1.5.0`

---

## 🚀 Overview

`@pphatdev/registry` **v1.5.0** introduces first-class **AI Agent Skill Management**, adopting the open `SKILL.md` standard modeled after `skills.sh` and `vercel-labs/skills`.

Developers can now discover, install, update, remove, and verify skills across any AI coding assistant (Antigravity / Universal Agent, Claude Code, Cursor, Windsurf, Cline, GitHub Copilot, and more) with automated agent detection and reproducible lockfile integrity.

---

## 🌟 Highlights & Key Features

### 1. `pphat add skill` — Install AI Agent Skills
Install skills directly from GitHub repositories, Git URLs, or local paths:

```bash
# Install skills from a GitHub repository
pphat add skill pphatdev/skills

# Install multiple skill packs in one command
pphat add skill pphatdev/skills vercel-labs/skills

# Install a specific skill by name
pphat add skill pphatdev/skills --skill api-documentation

# Target specific agents
pphat add skill pphatdev/skills -a claude cursor

# Non-interactive / CI-friendly mode
pphat add skill pphatdev/skills --all -y

# Inspect available skills without installing
pphat add skill pphatdev/skills --list
```

#### Interactive Terminal Experience:
- **Searchable Multi-Select:** Type keywords to filter skills in real time by name.
- **Circle Checkboxes:** Modern `○` (unselected) / `●` (selected) indicators toggled smoothly with the `Spacebar`.
- **Select All:** One-click toggle with a live counter (`Select All (0/N)`).
- **Live Description Panel:** Dynamically previews documentation for the currently focused skill.
- **Target Coding Agents Selection:** Auto-detects installed coding assistants in the workspace with `Universal Agent (.agent/skills)` selected by default.
- **Installation Scope:** Choose between Project-local (`.agent/skills/`) and Global (`~/.agent/skills/`).
- **Security Risk Assessments:** Aligned security assessment summary table with Gen, Socket, and Snyk status indicators.

---

### 2. `skills-lock.json` — Deterministic Integrity Lockfile
To ensure reproducibility across team members and CI/CD environments, installed skills are tracked in `skills-lock.json`:

```json
{
  "version": 1,
  "skills": {
    "api-documentation": {
      "source": "pphatdev/skills",
      "sourceType": "github",
      "skillPath": ".agents/skills/api-documentation/SKILL.md",
      "computedHash": "80e34d5a9899f6250366da728bd51d14fd941a54233d27891781b97b19a0823d"
    }
  }
}
```

- Calculates cryptographic **SHA-256 hashes** (`computeSkillFolderHash`) by recursively reading and sorting files in the skill directory.
- Guarantees skill reproducibility and prevents undetected upstream tampering.
- Paired alongside `.skills.json` for local workspace target tracking.

---

### 3. `pphat update skill` — Keep Skills Fresh
Easily update installed skills to their latest revisions:

```bash
# Update a specific skill repository
pphat update skill pphatdev/skills

# Update all installed skills in the project
pphat update skill
```

- Fetches the latest source revisions, re-discovers skills, and updates files.
- Automatically recomputes SHA-256 hashes and refreshes `skills-lock.json`.

---

### 4. `pphat remove skill` — Clean Skill Removal
Safely uninstall skills and clean all tracked references:

```bash
# Remove by repository source
pphat remove skill pphatdev/skills

# Remove by individual skill name
pphat remove skill api-documentation
```

- Removes skill files from all target directories.
- Automatically cleans entries from `.skills.json` and `skills-lock.json`.

---

### 5. `pphat list skills` — Inspect Installed Skills
View all skills currently installed in your project:

```bash
pphat list skills
```

---

### 6. 🛡️ Supply Chain Security & Hardening

- **Path Traversal Protection:**
  - Added strict skill identifier validation (`isValidSkillName`) rejecting directory traversal sequences (`..`), separators (`/`, `\`), null bytes, and hidden files.
  - Added boundary assertions (`assertSafeChildPath`) ensuring skills, components, and icons cannot escape their target directories.
  - Protected removal routines with guards preventing accidental or malicious deletion of filesystem root (`/`), home directory, or current project root.
- **Telemetry Credential Scrubbing:**
  - Automated redaction (`sanitizeArgs`) of embedded URL credentials (`https://[REDACTED]@...`), GitHub/GitLab/NPM tokens, and `--token`/`--secret` CLI flags before recording or transmitting telemetry.
- **CI/CD Security Hardening:**
  - Release workflow gated with mandatory `npm test` before `npm publish`.
  - Replaced `npm install` with `npm ci` in registry build pipeline for deterministic lockfile resolution.
  - Added Dependabot configuration (`.github/dependabot.yml`) for automated weekly dependency vulnerability monitoring across root npm, `/server` npm, and GitHub Actions.
- **Dependency & Toolchain Upgrades:**
  - Upgraded dependencies: `@inquirer/prompts` to `^8.7.5`, `ora` to `9.4.1`, `@types/node` to `^20.19.43`, `tsup` to `^9.0.0`, and TypeScript to `^5.9.3`.
  - Modernized `tsconfig.json` module resolution to `bundler` / `ESNext`.

---

## 🐛 Bug Fixes & Refinements

- **Component Format Validation:** Fixed a TypeScript type mismatch (`TS2345`) where parent commands (`pphat add` / `pphat remove`) could pass `format: 'svg'` to component handlers. Added validation ensuring components only accept `nextjs` or `nuxtjs`.
- **Flicker-Free Terminal Re-rendering:** Fixed an off-by-one ANSI line erasure calculation in the search multiselect prompt that previously caused duplicate headers (`◆ Select skills to install`) to accumulate during interactive navigation.

---

## 📦 What's Changed (Git Commits)

- `34fd01d` — **feat(skills):** add core skill manager with manifest and skills-lock.json support
- `5c83770` — **feat(cli):** add interactive search-multiselect prompt with skills.sh styling
- `fc58713` — **feat(cli):** add skill management commands (add, update, remove, list)
- `8705304` — **test(skills):** add integration test suite and update documentation
- `d158c23` — **chore:** bump version to 1.5.0
- `987cd96` — **fix(security):** prevent path traversal in skills, components, and icon installation
- `1b5f289` — **fix(security):** sanitize telemetry CLI arguments and redact sensitive credentials
- `4d0d471` — **ci(security):** gate publish with tests, enforce npm ci, and add dependabot config

---

## 🧪 Verification & Quality Assurance

- **Unit & Integration Tests:** All 35 tests passed across 4 test suites (`tests/skills.test.ts`, `tests/help.test.ts`, `tests/config*.test.ts`, `tests/init.test.ts`), including 3 automated supply chain security test cases.
- **Regression Tests:** All help, configuration, and command tests passed.
- **Type Safety:** `npx tsc --noEmit` verified with 0 errors.
- **Package Build:** `npm run build` compiled clean CommonJS bundles and DTS declarations.

