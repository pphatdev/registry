# @pphatdev/registry 🚀

[![npm version](https://img.shields.io/npm/v/@pphatdev/registry.svg?style=flat-square)](https://npmjs.org/package/@pphatdev/registry)
[![license](https://img.shields.io/npm/l/@pphatdev/registry.svg?style=flat-square)](https://npmjs.org/package/@pphatdev/registry)

A powerful and extremely fast CLI tool to instantly download and manage custom UI components and icons for your frontend projects. 

Instead of bundling thousands of heavy icons in an npm package, this CLI dynamically fetches precisely the components and icons you need on-demand. It supports outputting raw SVGs, or converting them into ready-to-use, perfectly formatted **Next.js** (React) or **Nuxt.js** (Vue) components!

## 🌟 Why @pphatdev/registry? (Best Practices)
- **Zero Bundle Bloat**: Only download the components and icons you actually use in your project.
- **Lightning Fast**: Powered by a static registry hosted on GitHub's raw CDN (no rate limits for users!).
- **Framework Native**: Automatically wraps SVGs into `.tsx` (React) or `.vue` (Nuxt) components if desired.
- **Perfect Code Formatting**: Integrates a smart XML formatter that precisely aligns tags, preserving nested CSS (`@keyframes`) and attributes for lint-free output.
- **Configurable & Persistent**: Automatically remembers your preferred directory and format via a tiny configuration file.

---

## 💻 Usage

You don't even need to install it! You can run it directly using `npx`. 
The CLI supports multiple convenient aliases (prefixes), so you can use any of the following interchangeably:
- `npx pphat`
- `npx pphatdev`
- `npx @pphatdev/registry`

### 1. Initialize your project
Run the `init` command to set up your preferences. It will interactively ask you which types of resources you want to manage (components, icons, or both) and what formats you prefer.
```bash
npx pphat init
```
*Here is an example of the interactive initialization process:*
```text
? What is name of config ? › Default configuration
? What do you want to use ? (required must select one) › Icons

? Which directory you want to use ? (required must select one) › Nextjs format (.tsx)
? Where do you store icon of nextjs ? › components/icons

Success! Configuration saved to pphatdev.json.
```

This generates a perfectly structured `pphatdev.json` file in the root of your project. Formats and sections you don't select are still written out with `"use": false` and their default `dir`, so you can enable them later by flipping the flag:
```json
{
  "name": "Default configuration",
  "icons": {
    "svg": {
      "dir": "public/icons",
      "use": false
    },
    "nextjs": {
      "dir": "components/icons",
      "use": true
    },
    "nuxtjs": {
      "dir": "components/icons",
      "use": false
    }
  },
  "components": {
    "nextjs": {
      "dir": "components/ui",
      "use": false
    },
    "nuxtjs": {
      "dir": "components/ui",
      "use": false
    }
  }
}
```

### 2. View and Update Configuration
You can interactively update or inspect your configuration anytime using the `config` command:
```bash
# Interactively update your project preferences
npx pphat config

# View current configuration
npx pphat config get

# Get or set a specific config key
npx pphat config get icons.nextjs.dir
npx pphat config set icons.nextjs.use true
```

### 3. Discover Items
To browse the available icons or components in the registry, you can use the `list` (or `ls`) command:
```bash
npx pphat list icons
npx pphat ls components
```
*It displays items in pages of 10, letting you use the arrow keys to browse!*

### 4. Add Icons or Components
To download one or multiple icons or components, use the `add-icon` (or `add`) and `add-component` (or `add-comp`) commands:

```bash
# Download icons
npx pphat add-icon react vue github

# Download components
npx pphat add-component button card modal

# Download using custom format or target directory
npx pphat add-icon react vue -d src/assets/icons
npx pphat add-component button -f nextjs -d src/components/ui
```
*It will automatically download and format them into the respective directory based on your `pphatdev.json` preferences.*

## 🌍 Global Installation (Optional)
If you plan to use it frequently across many projects, you can install it globally:
```bash
npm install -g @pphatdev/registry
```
Then use the short commands:
```bash
pphat init
pphat add-icon github
```

---

## 📊 Anonymous Usage Telemetry

This CLI collects anonymous usage stats so we can see which icons and components are most useful to the community and prioritize what to add next. For detailed telemetry information, opt-out methods, and self-hosting options, see [`docs/TELEMETRY.md`](./docs/TELEMETRY.md).

---


## 🛠 For Contributors / Registry Maintainers

Working on the CLI or updating the icon registry? See [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md) for build, publish, and registry-generation steps.

- [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md) — building the CLI and rebuilding the registry
- [`docs/DEPLOY.md`](./docs/DEPLOY.md) — deployment procedure
- [`docs/TELEMETRY.md`](./docs/TELEMETRY.md) — usage telemetry guide and opt-out details
- [`docs/TRACKER.md`](./docs/TRACKER.md) — telemetry backend notes
