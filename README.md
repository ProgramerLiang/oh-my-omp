# oh-my-omp

> **Status: Under development.** Not yet published to npm. Install from source — see below.

Terminal configuration dashboard for [omp](https://github.com/can1357/oh-my-pi), built on omp's own TUI framework for a fast, visual, tabbed interactive experience.

## Background

oh-my-omp is a standalone configuration tool for [oh-my-pi](https://github.com/can1357/oh-my-pi) (omp), inspired by [oh-pi](https://github.com/ifiokjr/oh-pi)'s CLI configurator. It provides a full-screen terminal dashboard to browse and change every omp setting — providers, models, themes, extensions, MCP servers, role routing, and system info — in one place.

## Install

Clone and run from source:

```sh
git clone https://github.com/ProgramerLiang/oh-my-omp.git
cd oh-my-omp
bun install
```

## Usage

```sh
bun packages/configurator/src/cli.ts --help
bun packages/configurator/src/cli.ts --version
bun packages/configurator/src/cli.ts --json
bun packages/configurator/src/cli.ts          # Launch dashboard
```

### Dashboard Tabs

| Tab | Description |
|-----|-------------|
| **Providers** | View, add, and test AI provider connections. Configure role-to-model routing. |
| **Models** | Browse all available models across providers, assign roles, view capabilities. |
| **Theme** | Select and preview terminal themes with live sample text. |
| **Extensions** | Enable and disable built-in and third-party extensions. |
| **MCP** | Manage Model Context Protocol server configurations. |
| **System** | View config paths, omp version, and cache/util commands. |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Next tab |
| `Ctrl+S` | Save changes |
| `Ctrl+Q` | Quit |
| `/` | Focus search |
| `↑` `↓` | Navigate items |
| `Enter` | Select / expand |
| `Space` | Toggle checkbox |

## Development

```sh
git clone https://github.com/ProgramerLiang/oh-my-omp.git
cd oh-my-omp
bun install
bun test
bun run check
```

## License

MIT — see the original [oh-my-pi](https://github.com/can1357/oh-my-pi) and [oh-pi](https://github.com/ifiokjr/oh-pi) repositories for upstream license terms.

## Credits

- [oh-my-pi](https://github.com/can1357/oh-my-pi) by Can Boluk — the omp coding-agent this tool configures
- [oh-pi](https://github.com/ifiokjr/oh-pi) by [ifiokjr](https://github.com/ifiokjr) — the original TUI configurator that inspired this project
