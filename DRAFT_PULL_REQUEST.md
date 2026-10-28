# Pull Request: AI Agent Skill Management & Supply Chain Security Hardening

## 📌 PR Title
`feat(skills): introduce AI Agent Skill management with supply chain security hardening (v1.5.1)`

---

## 🎯 Summary

This Pull Request introduces first-class **AI Agent Skill Management** into `@pphatdev/registry`, adopting the open `SKILL.md` specification modeled after `skills.sh` and `vercel-labs/skills`.

Developers and autonomous coding agents can now discover, install, update, remove, and verify skills across any modern AI coding assistant (Universal Agent / Antigravity, Claude Code, Cursor, Windsurf, Cline, Copilot, and more) with automated agent detection, reproducible lockfile hashing, and comprehensive supply chain security defenses.

---

## 🚀 Key Features & Changes

### 1. Skill Installation (`pphat add skill`)
- Direct installation from GitHub repositories (`pphatdev/skills`), Git URLs, or local directories.
- Multi-source installations: `pphat add skill pphatdev/skills vercel-labs/skills`.
- Individual skill targeting: `--skill <name>`.
- Agent targeting: `-a claude cursor` (installs directly into selected agent skill directories).
- Non-interactive / headless CI mode: `--all -y`.
- Inspection mode: `--list` (lists available skills inside a repo without installing).
- Standalone alias: `pphat add-skill`.

### 2. Interactive Terminal UI
- **Real-Time Text Filter:** Instant keyword filtering across all discovered repository skills.
- **Circle Checkboxes:** Modern `○` (unselected) / `●` (selected) indicators toggled cleanly with `Spacebar`.
- **Select All:** One-click toggle with real-time selection tally (`Select All (0/N)`).
- **Dynamic Description Panel:** Previews markdown instructions and description for the highlighted skill.
- **Automatic Coding Agent Detection:** Scans the workspace for agent configurations and selects `Universal Agent (.agent/skills)` by default.
- **Scope Selection:** Toggle between Project-local (`.agent/skills/`) and Global (`~/.agent/skills/`).
- **Security Risk Assessments Table:** Formatted, aligned risk indicator matrix (Gen, Socket, Snyk).

### 3. Deterministic Lockfile & Manifest
- **`skills-lock.json` (Version 1):** Cryptographic SHA-256 folder hashing (`computeSkillFolderHash`) matching the `skills.sh` hashing standard. Verifies skill reproducibility and detects upstream tampering.
- **`.skills.json` Manifest:** Tracks installed skill sources, target directories, and metadata within the workspace.

### 4. Skill Lifecycle Management
- **`pphat update skill [targets...]` / `pphat update-skill`:**
  - In-place updates for single, multiple, or all project skills.
  - Automatically refreshes files and updates cryptographic lockfile hashes.
- **`pphat remove skill <targets...>` / `pphat remove-skill`:**
  - Safely deletes skill folders from all target agent directories.
  - Automatically cleans references from `.skills.json` and `skills-lock.json`.
- **`pphat list skills`:**
  - Terminal view of all currently installed skills, source repositories, and storage paths.

---

## 🛡️ Supply Chain Security Hardening

- **Path Traversal Protection:**
  - Added `isValidSkillName()` validation rejecting directory traversal sequences (`..`), directory separators (`/`, `\`), null bytes, and hidden files (`.`).
  - Added `assertSafeChildPath()` to enforce that destination directories cannot escape base paths.
  - Guarded `discoverSkills()` against malicious `name` frontmatter in untrusted repositories.
  - Added safeguards to `removeSkillFiles()` refusing deletion of filesystem root (`/`), user home, or current project root.
  - Added path boundary checks to `add-icons` and `add-components`.
- **Telemetry Credential Scrubbing:**
  - Added `sanitizeArgs()` to automatically redact embedded URL credentials (`https://[REDACTED]@...`), GitHub/GitLab tokens (`ghp_`, `glpat-`), NPM tokens (`npm_`), and `--token`/`--secret` CLI arguments before telemetry recording or transmission.
- **CI/CD Hardening:**
  - Added mandatory `npm test` gate in `.github/workflows/publish-npm.yml` before publishing to npm.
  - Switched `.github/workflows/build-registry.yml` from `npm install` to deterministic `npm ci`.
  - Added `.github/dependabot.yml` configured for automated weekly vulnerability auditing across root npm, `/server` npm, and GitHub Actions.

---

## ⚡ Toolchain & Dependency Modernization

- **Commander v15:** Upgraded to `commander@^15.0.0` with standardized version flags (`-v, --version`).
- **Prompts & Terminal UI:** Upgraded to `@clack/prompts@^1.8.1`, `@inquirer/prompts@^8.7.5`, `ora@^9.4.1`, and `chalk@^6.0.1`.
- **TypeScript Configuration:** Modernized `tsconfig.json` to `moduleResolution: "bundler"` and `module: "ESNext"`, running on stable `typescript@^5.9.3` with `tsup@^9.0.0`.
- **Server Workspace:** Updated Cloudflare Workers dependencies (`wrangler`, `undici`, `sharp`) to resolve upstream security advisories.

---

## 🐛 Bug Fixes & Refinements

- **Component Format Narrowing:** Fixed TypeScript `TS2345` type mismatch where parent commands could pass `format: 'svg'` into component handlers that only accept `nextjs` or `nuxtjs`.
- **Prompt Line Erasure:** Fixed ANSI off-by-one row erasure calculation that previously caused duplicate headers (`◆ Select skills to install`) to accumulate during interactive arrow key navigation.
- **Commander 15 Option Conflict:** Fixed multiple short flag error by removing duplicate `-V` short option.

---

## 🧪 Verification & Automated Tests

All **35 automated tests** across 4 test suites are passing cleanly:

```bash
npx tsx --test tests/skills.test.ts tests/help.test.ts tests/config*.test.ts tests/init.test.ts
```

- **Skills Integration & Security (`tests/skills.test.ts`):** 20/20 tests passing:
  - Single, multi-skill, and multiple source installations
  - Manifest and `skills-lock.json` SHA-256 generation
  - In-place updates and targeted removals
  - CLI list and non-interactive `--all -y` execution
  - Path traversal rejection (`isValidSkillName` & `assertSafeChildPath`)
  - Telemetry credential redaction (`sanitizeArgs`)
- **CLI Commands & Hyphenated Aliases (`tests/help.test.ts`):** 10/10 tests passing
- **Configuration Parsing & Merging (`tests/config*.test.ts`):** 5/5 tests passing
- **Interactive Initialization (`tests/init.test.ts`):** 3/3 tests passing
- **Type Checking:** `npx tsc --noEmit` verified with 0 errors.
- **Build Verification:** `npm run build` compiled clean CommonJS bundles and DTS declarations in `dist/` and binary shims in `bin/`.

---

## 📋 Reviewer Checklist

- [x] All unit and integration tests pass.
- [x] TypeScript compiler passes with 0 errors.
- [x] Package build succeeds (`npm run build`).
- [x] Lockfile integrity hashing verified against `skills.sh` standard.
- [x] Security validations in place for all path and file operations.
- [x] Release documentation prepared in `DRAFT_RELEASE.md`.

