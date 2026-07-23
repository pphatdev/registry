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

### 3. Add an Item
To download a component or icon (e.g., React, Vue, GitHub, etc.), use the `add` command:
```bash
npx pphat add react
```
*It will automatically download and format it into the respective directory based on your `pphatdev.json` preferences.*

#### Overriding formats on the fly:
If you want to download an item in a specific format just once, you can pass the `-f` or `--format` flag:
```bash
# Download as raw SVG
npx pphat add react -f svg

# Download as Next.js React component
npx pphat add react -f nextjs

# Download as Nuxt.js Vue component
npx pphat add react -f nuxtjs
```

## 🌍 Global Installation (Optional)
If you plan to use it frequently across many projects, you can install it globally:
```bash
npm install -g @pphatdev/registry
```
Then use the short commands:
```bash
pphat init
pphat add github
```

---

## 🛠 For Contributors / Registry Maintainers
*If you are looking to update the icon registry itself, follow these steps.*

### Building the Registry
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
