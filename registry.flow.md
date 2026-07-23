# @pphatdev/registry - System Architecture & Workflow

This document describes the complete system architecture, CLI command flows, and registry compilation process for `@pphatdev/registry`.

---

## 1. High-Level System Architecture

```mermaid
flowchart LR
    classDef developer fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef cli fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#f8fafc;
    classDef cdn fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#f8fafc;
    classDef local fill:#701a75,stroke:#f0abfc,stroke-width:2px,color:#f8fafc;

    subgraph Client ["💻 Developer Environment"]
        Dev["👤 Developer"]:::developer
        Config["📄 pphatdev.json"]:::local
        TargetFiles["📂 src/components/ & public/icons/"]:::local
    end

    subgraph Engine ["⚡ @pphatdev/registry CLI Core"]
        CLIInit["🚀 pphat init / config"]:::cli
        CLIAdd["📥 pphat add-icon / add-component"]:::cli
        Compiler["⚙️ Compiler & XML Formatter"]:::cli
    end

    subgraph Registry ["☁️ Remote Registry (GitHub CDN)"]
        IndexJSON["📦 index.json Catalog"]:::cdn
        ItemJSON["🎨 Icon & Component JSON Assets"]:::cdn
    end

    Dev -->|Runs setup| CLIInit
    CLIInit -->|Reads / Writes| Config
    Dev -->|Runs download| CLIAdd
    CLIAdd -->|1. Check preferences| Config
    CLIAdd -->|2. Request catalog| IndexJSON
    CLIAdd -->|3. Fetch item data| ItemJSON
    ItemJSON -->|4. Raw SVG / Code| Compiler
    Compiler -->|5. Output React / Vue / SVG| TargetFiles
```

---

## 2. Interactive Initialization Flow (`pphat init`)

The `init` command sets up the default project configuration file (`pphatdev.json`) with all icon and component options pre-populated.

```mermaid
flowchart TD
    classDef startEnd fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#fff;
    classDef prompt fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#fff;
    classDef decision fill:#701a75,stroke:#f0abfc,stroke-width:2px,color:#fff;
    classDef process fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#fff;

    Start(["🚀 pphat init"]):::startEnd --> P1["💬 Prompt: What is name of config?"]:::prompt
    P1 --> P2["💬 Prompt: What do you want to use? (Components / Icons / Both)"]:::prompt
    
    P2 --> BaseConfig["⚙️ Initialize default config template (use: false)"]:::process

    subgraph IconBranch ["🎨 Icons Setup"]
        CheckIcons{"Selection includes Icons?"}:::decision
        CheckIcons -- Yes --> P3_Icons["💬 Prompt: Which icon formats? (.svg, .tsx, .vue)"]:::prompt
        P3_Icons --> P4_Icons["💬 Prompt: Target directories for selected icons"]:::prompt
        P4_Icons --> SetIcons["Set selected icon formats: use = true"]:::process
    end

    subgraph CompBranch ["🧩 Components Setup"]
        CheckComps{"Selection includes Components?"}:::decision
        CheckComps -- Yes --> P3_Comps["💬 Prompt: Which component formats? (.tsx, .vue)"]:::prompt
        P3_Comps --> P4_Comps["💬 Prompt: Target directories for selected components"]:::prompt
        P4_Comps --> SetComps["Set selected component formats: use = true"]:::process
    end

    BaseConfig --> CheckIcons
    CheckIcons -- No --> CheckComps
    SetIcons --> CheckComps
    SetComps --> SaveFile["💾 Save pphatdev.json"]:::process
    CheckComps -- No --> SaveFile
    SaveFile --> EndInit(["✅ Initialization Complete"]):::startEnd
```

---

## 3. Configuration Management Flow (`pphat config`)

The `config` command allows users to view, interactively update, or programmatically set properties in `pphatdev.json`.

```mermaid
flowchart TD
    classDef main fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#fff;
    classDef sub fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#fff;
    classDef act fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#fff;

    Cmd(["⚙️ pphat config"]):::main --> Action{"Select Subcommand / Mode"}:::main

    subgraph Interactive ["🔄 Interactive Mode"]
        Action -- "pphat config" --> LoadCurrent["Read pphatdev.json"]:::sub
        LoadCurrent --> PromptInteractive["Re-prompt preferences with defaults pre-filled"]:::sub
        PromptInteractive --> SaveInteractive["Write updated pphatdev.json"]:::act
    end

    subgraph Inspect ["🔍 Inspection Mode"]
        Action -- "pphat config get [key]" --> ReadConfig["Read pphatdev.json"]:::sub
        ReadConfig --> KeyCheck{"Key Provided?"}:::sub
        KeyCheck -- No --> PrintFull["Display complete JSON"]:::act
        KeyCheck -- Yes --> PrintKey["Display property value"]:::act
    end

    subgraph Mutation ["✏️ Mutation Mode"]
        Action -- "pphat config set <key> <value>" --> ReadSet["Read pphatdev.json"]:::sub
        ReadSet --> ApplyMutation["Mutate nested JSON property"]:::sub
        ApplyMutation --> SaveSet["Write updated pphatdev.json"]:::act
    end

    SaveInteractive --> Finish(["Done"]):::main
    PrintFull --> Finish
    PrintKey --> Finish
    SaveSet --> Finish
```

---

## 4. Download & Transformation Engine (`pphat add-icon` & `pphat add-component`)

Downloads one or multiple icons/components, applies framework transformations (SVG to React/Next.js `.tsx` or Vue/Nuxt.js `.vue`), and writes them to the project.

```mermaid
flowchart TD
    classDef entry fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#fff;
    classDef step fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#fff;
    classDef check fill:#701a75,stroke:#f0abfc,stroke-width:2px,color:#fff;
    classDef transform fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#fff;

    StartAdd(["📥 pphat add-icon / add-component <names...>"]):::entry --> LoadConfig["Load pphatdev.json"]:::step
    LoadConfig --> FetchIdx["Fetch index.json from GitHub CDN"]:::step

    subgraph ExecutionLoop ["🔄 Multi-Item Processing Loop"]
        FetchIdx --> ItemLoop["For each item in names..."]:::step
        ItemLoop --> MatchItem{"Item exists in index?"}:::check
        MatchItem -- No --> ErrorSkip["❌ Log error & skip item"]:::check
        MatchItem -- Yes --> FetchJSON["Fetch asset JSON content"]:::step

        subgraph TransformationPipeline ["⚡ Transformation Pipeline"]
            FetchJSON --> CheckFormat["Determine output formats (-f flag or config)"]:::step
            CheckFormat --> FormatLoop["For each format (svg, nextjs, nuxtjs)..."]:::step
            FormatLoop --> ResolvePath["Resolve target dir (-d flag or config.dir)"]:::step
            ResolvePath --> CheckType{"Source Type"}:::check
            
            CheckType -- "SVG Content" --> TransformSVG["Transform SVG via Compiler Engine"]:::transform
            CheckType -- "Native Component" --> ValidateExt["Validate format extension match"]:::transform

            TransformSVG --> ReactXform["React / Next.js: TSX + forwardRef + PascalCase"]:::transform
            TransformSVG --> VueXform["Vue / Nuxt.js: Single File Component <template>"]:::transform

            ReactXform --> CheckExists{"File exists on disk?"}:::check
            VueXform --> CheckExists
            ValidateExt --> CheckExists

            CheckExists -- Yes --> PromptOverwrite["💬 Confirm overwrite"]:::step
            PromptOverwrite -- Overwrite/No --> SkipWrite["Skip file"]:::step
            PromptOverwrite -- Yes --> WriteDisk["💾 Save file to disk"]:::transform
            CheckExists -- No --> WriteDisk
        end

        WriteDisk --> NextFormat{"More formats?"}:::check
        SkipWrite --> NextFormat
        NextFormat -- Yes --> FormatLoop
        NextFormat -- No --> NextItem{"More items?"}:::check
        ErrorSkip --> NextItem
        NextItem -- Yes --> ItemLoop
    end

    NextItem -- No --> Complete(["🎉 Download Complete"]):::entry
```

---

## 5. Registry Search & Listing Flow (`pphat list`)

Browses icons or components stored in the remote registry with paginated output.

```mermaid
flowchart TD
    classDef listNode fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#fff;
    classDef listCheck fill:#701a75,stroke:#f0abfc,stroke-width:2px,color:#fff;
    classDef listEnd fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#fff;

    StartList(["📋 pphat list icons / components"]):::listEnd --> FetchIdx["Fetch registry index from GitHub CDN"]:::listNode
    FetchIdx --> FilterType["Filter items by category (icons vs components)"]:::listNode
    FilterType --> GroupCategory["Group and sort items by category"]:::listNode
    GroupCategory --> DisplayPage["Display 10 items in terminal"]:::listNode
    DisplayPage --> PageCheck{"More items remaining?"}:::listCheck
    PageCheck -- Yes --> PromptEnter["💬 Prompt: Press Enter for more, or 'q' to quit"]:::listNode
    PromptEnter -- Enter --> DisplayPage
    PromptEnter -- "q" --> ExitList(["Exit"]):::listEnd
    PageCheck -- No --> ExitList
```

---

## 6. Registry Builder Script Flow (`src/scripts/build-registry.ts`)

Converts source SVGs and components from GitHub repositories into optimized JSON entries served by the CDN.

```mermaid
flowchart LR
    classDef source fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#fff;
    classDef script fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#fff;
    classDef output fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#fff;

    subgraph GitHub ["🐙 GitHub Repositories"]
        IconsRepo["Icons Repository (SVG assets)"]:::source
        ComponentsRepo["Components Repository (TSX/Vue)"]:::source
    end

    subgraph Script ["⚡ Build Script (src/scripts/build-registry.ts)"]
        GH_API["GitHub REST API (with GITHUB_TOKEN)"]:::script
        Parser["SVG / Code Optimization & Metadata Extractor"]:::script
        IndexGen["Index Catalog Generator"]:::script
    end

    subgraph RegistryOutput ["📦 Generated Registry Output"]
        IndexFile["registry/index.json"]:::output
        AssetFiles["registry/*.json (Individual Assets)"]:::output
    end

    IconsRepo --> GH_API
    ComponentsRepo --> GH_API
    GH_API --> Parser
    Parser --> IndexGen
    IndexGen --> IndexFile
    Parser --> AssetFiles
```
