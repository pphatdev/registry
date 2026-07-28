# Development Guide

*If you are looking to update the icon registry itself or work on the CLI, follow these steps.*

## Building the CLI

Both `dist/` (the compiled CLI bundle) and `bin/` (the executable shims) are **generated artifacts** — they are gitignored and not present in a fresh clone. After cloning, run:

```bash
npm install
npm run build
```

This runs `build:cli` (bundles `src/index.ts` → `dist/index.js`) followed by `build:bin` (regenerates `bin/*.js` from the `bin` field in `package.json`).

You only need to re-run `npm run build:bin` when you add or rename a bin alias in `package.json`. Editing `src/**` triggers a normal `npm run build` (or `npm run dev` for watch mode).

Publishing (`npm publish`) automatically runs `npm run build` via the `prepack` hook, so the tarball always ships freshly built `dist/` and `bin/`.

## Building the Registry

The icons are hosted on a GitHub repository and parsed into a lightweight `registry/index.json`. To rebuild the registry locally:

1. Generate a GitHub Personal Access Token.
2. Run the build script with the token in your environment (to avoid GitHub API rate limits):

```bash
# Linux / macOS
GITHUB_TOKEN="your_token" npm run build:registry

# Windows (PowerShell)
$env:GITHUB_TOKEN="your_token"; npm run build:registry
```

> **Note**: There is an automated GitHub Actions workflow included that runs automatically whenever a new GitHub **Release** is published, ensuring the registry stays perfectly up to date!

## Related Docs

- [DEPLOY.md](./DEPLOY.md) — deployment / release procedure
- [TRACKER.md](./TRACKER.md) — telemetry backend notes
