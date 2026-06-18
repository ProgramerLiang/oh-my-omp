# omp-config

Terminal UI configuration dashboard for [omp](https://omp.sh).

## Installation

```bash
bun install -g @oh-my-pi/omp-configurator
```

Or run directly:

```bash
bunx @oh-my-pi/omp-configurator
```

## Usage

```
omp-config [--help] [--version] [--json]
```

| Flag | Description |
|------|-------------|
| `--help`, `-h` | Show help text |
| `--version`, `-v` | Print version |
| `--json` | Print resolved configuration as JSON |

Without flags, `omp-config` starts the interactive dashboard.

### Key bindings

| Key | Action |
|-----|--------|
| Tab | Cycle to next tab |
| Ctrl+S | Save changes |
| Ctrl+Q | Quit |

## Configuration areas

### Providers

Configure API providers (OpenAI, Anthropic, etc.). Each provider shows its connection state, model count, assigned roles, and API key status.

### Models

Browse available models per provider. Models show their capabilities and assigned roles.

### Theme

Select a theme for the terminal UI. The list includes bundled themes; the current selection is highlighted.

### Extensions

View disabled extensions from your configuration. Extensions are listed by ID with their enablement state.

### MCP

Review configured MCP (Model Context Protocol) servers. Each entry shows the command, arguments, and environment variable count.

### System

Summary of agent directory, configuration path, and version information.

## Configuration file

`omp-config` reads and writes `~/.omp/agent/config.yml` (or `$OMP_CONFIG_DIR/config.yml` when set).

### Example

```yaml
theme: tokyo-night
disabledExtensions:
  - diagnostics
  - telemetry
```

## API

The package exports functions for programmatic use:

```typescript
import {
  createDashboard,
  readConfigState,
  writeConfigChanges,
  diffConfigStates,
  resolveAgentDir,
  resolveConfiguratorVersion,
} from "@oh-my-pi/omp-configurator";
```

See the [TypeScript source](./src/) for full API documentation.