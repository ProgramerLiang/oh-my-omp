# omp-configurator Design Specification

> A standalone TUI configuration dashboard for oh-my-pi (omp), inspired by oh-pi's CLI configurator but built on omp's own `@oh-my-pi/pi-tui` framework for a richer, faster, more visual experience.

**Status:** Approved design  
**Date:** 2026-06-15  
**Package:** `@oh-my-pi/omp-configurator`  
**Binary:** `omp-config`

---

## 1. Motivation

oh-my-pi (omp) is a powerful coding-agent fork with 40+ providers, 32 built-in tools, and extensive configuration options. However, it lacks a **unified visual configuration tool** — users must edit YAML files directly or use CLI commands (`omp config get/set`, `omp models`, `omp setup`) which are powerful but scattered.

oh-pi's CLI configurator (`@ifi/oh-pi-cli`) demonstrates the value of a TUI configurator for setting up providers, models, themes, extensions, and routing. omp-configurator goes further by:

- Building on omp's own differential-rendering TUI framework (`@oh-my-pi/pi-tui`) for smooth, flicker-free interaction
- Providing real-time provider connection status and model discovery
- Offering a tabbed dashboard for browsing and changing all configuration at once
- Being a standalone tool that also integrates as an optional omp plugin

## 2. Package Architecture

### 2.1 Directory Structure

```
packages/configurator/
├── package.json
│   name: "@oh-my-pi/omp-configurator"
│   bin: { "omp-config": "src/cli.ts" }
│   dependencies:
│     - @oh-my-pi/pi-tui (catalog:)
│     - @oh-my-pi/pi-utils (catalog:)
│     - @oh-my-pi/pi-catalog (catalog:)
│     - @oh-my-pi/pi-agent-core (catalog:)
│     - @oh-my-pi/pi-ai (catalog:)
│     - @oh-my-pi/pi-natives (catalog:)
│     - chalk (catalog:)
├── src/
│   ├── cli.ts                # CLI entrypoint
│   ├── index.ts              # Programmatic exports for plugin integration
│   ├── dashboard/
│   │   ├── index.ts          # Dashboard: TabBar + tab routing
│   │   ├── tabs/
│   │   │   ├── providers.ts  # Provider management tab
│   │   │   ├── models.ts     # Model browsing + role routing tab
│   │   │   ├── theme.ts      # Theme selector tab
│   │   │   ├── extensions.ts # Extension toggle tab
│   │   │   ├── mcp.ts        # MCP server config tab
│   │   │   └── system.ts     # System info + utilities tab
│   │   └── status-bar.ts     # Bottom status bar component
│   ├── config/
│   │   ├── reader.ts         # Read/parse omp config files
│   │   ├── writer.ts         # Write changes to config.yml
│   │   └── diff.ts           # Compute config changes for preview
│   ├── components/
│   │   ├── provider-card.ts  # Provider status card (expandable)
│   │   ├── model-cell.ts     # Model row with search/role assign
│   │   ├── role-router.ts    # Role → model assignment widget
│   │   ├── connection-test.ts# Provider connectivity test widget
│   │   ├── add-provider-dialog.ts  # Dialog for adding a provider
│   │   └── theme-preview.ts  # Live theme preview cards
│   └── utils/
│       ├── omp.ts            # Find omp binary, agent dir, version
│       ├── models.ts         # Catalog integration helpers
│       └── format.ts         # Display formatting helpers
├── test/
│   ├── dashboard.test.ts
│   ├── config-reader.test.ts
│   ├── config-writer.test.ts
│   └── components.test.ts
└── README.md
```

### 2.2 Key Design Decisions

**Configuration Access:**
- Read/write the same `~/.omp/agent/config.yml` that `omp` uses, via `@oh-my-pi/pi-utils`'s `Settings` API
- Read `~/.omp/agent/models-config.yml` via `@oh-my-pi/pi-agent-core`'s `ModelRegistry` for model state
- Changes made in the dashboard are immediately visible to the next `omp` session
- Use file-watching (`fs.watch`) to detect external config changes

**Independence:**
- `omp-config` is a standalone binary — no running `omp` process needed
- Package is published to npm as `@oh-my-pi/omp-configurator`
- Also installable via `omp plugin install @oh-my-pi/omp-configurator`

**TUI Framework:**
- Built entirely on `@oh-my-pi/pi-tui` components
- Uses `ProcessTerminal` for raw terminal I/O
- Uses `TUI` as the main container with differential rendering
- Reuses existing components: `TabBar`, `SettingsList`, `SelectList`, `Input`, `Text`, `ScrollView`, `Box`, `Markdown`

### 2.3 CLI Entrypoint

```
Usage: omp-config [options]

Options:
  --help, -h     Show help
  --version, -v  Show version
  --tab <name>   Open directly to a specific tab (providers|models|theme|extensions|mcp|system)
  --json         Output dashboard data as JSON (non-interactive)
  --check        Check configuration health, exit with code

Environment:
  OMP_CONFIG_DIR  Override agent config directory (default: ~/.omp/agent)
```

## 3. Dashboard Layout

### 3.1 Screen Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ Providers │ Models │ Theme │ Extensions │ MCP │ System   [✕]    │  ← TabBar
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   [Tab content — different per tab]                              │  ← ScrollView
│                                                                  │
│   ┌──────────────────────────────────────────────────────────┐   │
│   │ Content area...                                          │   │
│   └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ omp 15.13.3 │ ~/.omp/agent/config.yml ✓ │ ⚡ 4 providers         │  ← StatusBar
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Tree

```
Dashboard
├── TabBar (6 tabs, built-in @oh-my-pi/pi-tui TabBar component)
├── ScrollView (wraps each tab's content)
│   ├── ProvidersTab
│   │   ├── Input (search field, / shortcut)
│   │   ├── Box (section: 已配置 providers)
│   │   │   └── ProviderCard × N (custom expandable SettingsList items)
│   │   ├── Box (section: 添加 provider)
│   │   │   └── SelectList (available providers to add)
│   │   └── Box (section: 角色路由)
│   │       └── RoleRouter (custom component, SettingsList with submenus)
│   ├── ModelsTab
│   │   ├── Input (search field)
│   │   └── ModelCell × N (custom SettingsList item rows)
│   ├── ThemeTab
│   │   ├── Grid/Box (theme preview cards)
│   │   └── SettingsList (appearance options)
│   ├── ExtensionsTab
│   │   └── SelectList (enable/disable toggles)
│   ├── MCPTab
│   │   └── SettingsList with submenus
│   └── SystemTab
│       └── SettingsList (info, cache, debug)
└── StatusBar (custom, pinned to bottom)
```

### 3.3 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Tab` / `Shift+Tab` | Next/previous tab |
| `Ctrl+S` | Save changes |
| `Ctrl+Q` / `q` / `Escape` | Quit (prompt if unsaved) |
| `Ctrl+Z` | Undo last change |
| `/` | Focus search in current tab |
| `↑` / `↓` | Navigate items |
| `Enter` | Select / expand item |
| `Space` | Toggle (checkboxes) |
| `d` | Delete selected item |
| `n` | Add new item (provider, MCP server) |
| `?` | Help overlay |

## 4. Tab Specifications

### 4.1 Providers Tab

**Purpose:** View, add, edit, and test AI provider connections. Configure role-to-model routing.

**Data source:**
- `ModelRegistry.getAvailable()` — available providers with models
- `settings.get("providers.*")` — configured provider credentials
- `models-config.yml` — provider config (base URLs, API keys, discovery)

**Widgets:**
- **Search input** — filter provider list by name
- **ProviderCard** (custom):
  - Provider name + icon
  - Connection status indicator (green=connected, yellow=configured, gray=disconnected)
  - Configured model count
  - Assigned roles
  - Expandable detail: API key (masked), base URL, available models list, connection test button
  - Actions: edit, disconnect/test, set as default
- **Add Provider dialog** (fullscreen overlay):
  1. Select provider from list (SelectList with fuzzy search)
  2. Enter API key / base URL
  3. Select API mode (openai-responses, anthropic-messages, etc.)
  4. Connection test (optional)
  5. Model discovery
  6. Confirm
- **RoleRouter** (custom):
  - Table of roles (default, smol, slow, plan, commit) → assigned model
  - Each row is a SettingsList item that opens model selector on Enter
  - Model selector (SelectList with search + provider filter)

**Error handling:**
- Invalid API key: show error toast, allow retry
- Connection timeout: show timeout with retry option
- Discovery failure: show partial results + suggest retry
- Duplicate provider: warn and merge or cancel

### 4.2 Models Tab

**Purpose:** Browse all available models across providers, view details, assign roles.

**Data source:**
- `@oh-my-pi/pi-catalog` bundled model list
- Provider discovery results
- Current role assignments from settings

**Widgets:**
- **Search input** — filter by model name/provider
- **Filter chips** — by provider, capability (reasoning, vision, code), availability
- **ModelCell** (custom):
  - Model ID + provider
  - Capability badges (vision, reasoning, code, fast)
  - Role assignment indicators
  - Actions: assign to role, view on provider dashboard

### 4.3 Theme Tab

**Purpose:** Select and preview terminal themes.

**Data source:**
- `@oh-my-pi/pi-tui` theme providers
- `settings.get("theme")` — current theme
- omp built-in themes from `packages/tui/src/modes/theme/`

**Widgets:**
- **ThemePreview cards** (grid of theme cards showing sample colors/keywords)
- **SettingsList** for appearance options:
  - Plain icons toggle
  - Compact mode
  - Font size (if applicable)

### 4.4 Extensions Tab

**Purpose:** Enable/disable built-in and third-party extensions.

**Data source:**
- `settings.get("disabledExtensions")` — disabled state
- Capability system discovery for available extensions

**Widgets:**
- **SelectList** with checkbox toggles:
  - Each extension shows name + description
  - Enabled/disabled state
  - Open/closed source marker

### 4.5 MCP Tab

**Purpose:** Manage MCP (Model Context Protocol) server configurations.

**Data source:**
- `settings.get("mcpServers")` — configured servers
- Filesystem discovery (`mcp.json`, `.mcp.json`, `.omp/mcp.json`, `~/.omp/agent/mcp.json`)

**Widgets:**
- **SettingsList** with expandable items:
  - Server name + command
  - Environment variable count
  - Status indicator
  - Expandable: edit command, env vars, test connection
- **Add MCP Server** dialog:
  - Enter name, command, args
  - Add env vars (key-value pairs)
  - Test connection

### 4.6 System Tab

**Purpose:** System information, cache management, debug utilities.

**Data source:**
- `Settings` state
- File system inspection
- Model registry stats

**Widgets:**
- **SettingsList** with read-only and action items:
  - omp version, config path, config validity
  - Cache clearing buttons
  - Config export
  - Raw config.yml viewer

## 5. Data Flow

### 5.1 Reading Config

```
Dashboard mounted
  → ConfigReader.init()
    → Load settings via @oh-my-pi/pi-utils Settings API
    → Load model registry via @oh-my-pi/pi-agent-core ModelRegistry
    → Load extensions state via capability system
    → Return ConfigState snapshot
  → Distribute state to each tab component
  → Each tab renders from its slice
```

### 5.2 Writing Config

```
User changes a value in dashboard
  → Component sets local dirty state
  → StatusBar shows "Unsaved changes"
  → User presses Ctrl+S
    → ConfigWriter.flush()
      → Compute diff of changes
      → Validate changes (schema check)
      → Write to config.yml (via Settings.set + flush)
      → Write to models-config.yml if needed
      → Clear dirty state
      → StatusBar shows "Saved ✓"
  → User presses Ctrl+Z (undo)
    → Revert last change in-memory
    → (If already saved, restore from backup)
```

### 5.3 Dirty State Tracking

Each tab tracks its own dirty state. The dashboard aggregates:
```
Dashboard
├── ProvidersTab.dirty: boolean
├── ModelsTab.dirty: boolean
├── ThemeTab.dirty: boolean
├── ExtensionsTab.dirty: boolean
├── MCPTab.dirty: boolean
└── SystemTab.dirty: boolean (rarely dirty)

→ anyDirty = tabs.some(t => t.dirty)
→ StatusBar: "[Unsaved]" indicator
→ On quit if anyDirty: confirm dialog
```

## 6. Error Handling Strategy

| Scenario | Behavior |
|----------|----------|
| Config file missing | Auto-create with defaults, show info toast |
| Config file parse error | Show error with location, offer manual edit |
| Provider connection fails | Show failed status on card, allow retry |
| Model discovery times out | Show partial results, suggest retry with timeout increase |
| Write permission denied | Show error with path, suggest chmod/sudo |
| External config change detected | Show notification, offer reload or keep current |
| Version mismatch (omp updated) | Show notification, suggest refresh |

## 7. Testing Strategy

**Unit tests:**
- `ConfigReader` — parse valid/invalid configs, handle missing files
- `ConfigWriter` — write changes, diff computation, edge cases
- Individual components — render width constraints, empty states
- Provider status detection — mock connection results

**Integration tests:**
- Dashboard with mock TUI terminal
- Full provider add flow
- Config read→modify→write→verify cycle

**Test conventions:**
- Follow existing oh-my-pi patterns: `bun test --parallel`
- Use in-memory Settings for test isolation (`Settings.init({ inMemory: true })`)
- Avoid file system side effects in unit tests
- Use `ProcessTerminal` test harness for TUI component tests

## 8. Integration as omp Plugin

To support `omp plugin install`:

1. Package declares `pi` manifest in package.json:
```json
{
  "pi": {
    "name": "omp-configurator",
    "description": "TUI configuration dashboard for omp"
  }
}
```

2. The configurator's `index.ts` exports:
```typescript
export function openDashboard(options?: { tab?: string }): void;
export function getConfigState(): Promise<ConfigState>;
export function getProviderStatus(): Promise<ProviderStatus[]>;
```

3. Plugin can be invoked from within omp via a slash command:
```
/configure
```
which opens the dashboard as a fullscreen overlay in the running omp session.