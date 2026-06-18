# omp-configurator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@oh-my-pi/omp-configurator`, a standalone full-screen TUI dashboard for configuring omp providers, models, themes, extensions, MCP servers, and system settings.

**Architecture:** Add a new `packages/configurator` workspace package with its own `omp-config` binary. The package renders with `@oh-my-pi/pi-tui`, reads/writes omp config files through small config adapters, and exports a `createDashboard()` API for later plugin integration.

**Tech Stack:** Bun, TypeScript, Biome, tsgo, Bun test, `@oh-my-pi/pi-tui`, `@oh-my-pi/pi-utils`, `@oh-my-pi/pi-catalog`, `chalk`, `zod`.

---

## File Structure

Create:

- `packages/configurator/package.json` — package manifest, `omp-config` binary, scripts, dependencies, plugin metadata.
- `packages/configurator/tsconfig.json` — package TypeScript config.
- `packages/configurator/README.md` — usage and supported configuration areas.
- `packages/configurator/src/cli.ts` — CLI entrypoint.
- `packages/configurator/src/index.ts` — public API exports.
- `packages/configurator/src/types.ts` — shared state and component types.
- `packages/configurator/src/config/reader.ts` — load config state.
- `packages/configurator/src/config/writer.ts` — persist config changes.
- `packages/configurator/src/config/diff.ts` — compute displayable changes.
- `packages/configurator/src/dashboard/index.ts` — main dashboard component.
- `packages/configurator/src/dashboard/status-bar.ts` — bottom status line.
- `packages/configurator/src/dashboard/tabs/{providers,models,theme,extensions,mcp,system}.ts` — tab renderers.
- `packages/configurator/src/components/{provider-card,model-cell,role-router,theme-preview}.ts` — reusable render helpers.
- `packages/configurator/src/utils/{format,omp}.ts` — formatting and omp path/version helpers.
- `packages/configurator/test/{dashboard,config-reader,config-writer,diff,components}.test.ts` — tests.

Do not modify `packages/tui` unless a failing test proves a generic component bug. Product-specific UI belongs in `packages/configurator`.

---

## Task 1: Scaffold package and public types

**Files:**
- Create: `packages/configurator/package.json`
- Create: `packages/configurator/tsconfig.json`
- Create: `packages/configurator/src/types.ts`
- Create: `packages/configurator/src/index.ts`
- Create: `packages/configurator/src/cli.ts`
- Create: `packages/configurator/src/dashboard/index.ts`
- Test: `packages/configurator/test/dashboard.test.ts`

- [ ] **Step 1: Write the failing dashboard smoke test**

Create `packages/configurator/test/dashboard.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { createDashboard } from "../src";
import type { ConfigState } from "../src";

function state(overrides: Partial<ConfigState> = {}): ConfigState {
	return {
		agentDir: "/tmp/omp-agent",
		configPath: "/tmp/omp-agent/config.yml",
		version: "0.0.0-test",
		providers: [],
		models: [],
		roles: [],
		theme: "default",
		extensions: [],
		mcpServers: [],
		dirty: false,
		...overrides,
	};
}

describe("Dashboard", () => {
	test("renders the full tab row", () => {
		const text = createDashboard(state()).render(100).join("\n");
		expect(text).toContain("[Providers]");
		expect(text).toContain("Models");
		expect(text).toContain("Theme");
		expect(text).toContain("Extensions");
		expect(text).toContain("MCP");
		expect(text).toContain("System");
	});
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```bash
bun --cwd=packages/configurator test test/dashboard.test.ts
```

Expected: FAIL because the package does not exist.

- [ ] **Step 3: Create package manifest**

Create `packages/configurator/package.json`:

```json
{
	"type": "module",
	"name": "@oh-my-pi/omp-configurator",
	"version": "15.13.3",
	"description": "Standalone TUI configuration dashboard for omp",
	"homepage": "https://omp.sh",
	"author": "Can Boluk",
	"license": "MIT",
	"repository": {
		"type": "git",
		"url": "git+https://github.com/can1357/oh-my-pi.git",
		"directory": "packages/configurator"
	},
	"bugs": { "url": "https://github.com/can1357/oh-my-pi/issues" },
	"keywords": ["omp", "configuration", "tui", "terminal", "dashboard"],
	"main": "./src/index.ts",
	"types": "./src/index.ts",
	"bin": { "omp-config": "src/cli.ts" },
	"scripts": {
		"check": "biome check . && bun run check:types",
		"check:types": "tsgo -p tsconfig.json --noEmit",
		"lint": "biome lint .",
		"test": "bun test --parallel test/*.test.ts",
		"fix": "biome check --write --unsafe .",
		"fmt": "biome format --write ."
	},
	"dependencies": {
		"@oh-my-pi/pi-catalog": "catalog:",
		"@oh-my-pi/pi-tui": "catalog:",
		"@oh-my-pi/pi-utils": "catalog:",
		"chalk": "catalog:",
		"zod": "catalog:"
	},
	"devDependencies": { "@types/bun": "catalog:" },
	"engines": { "bun": ">=1.3.14" },
	"files": ["src", "README.md", "CHANGELOG.md"],
	"exports": {
		".": { "types": "./src/index.ts", "import": "./src/index.ts" },
		"./*": { "types": "./src/*.ts", "import": "./src/*.ts" }
	},
	"pi": {
		"name": "omp-configurator",
		"description": "TUI configuration dashboard for omp"
	}
}
```

- [ ] **Step 4: Create tsconfig**

Create `packages/configurator/tsconfig.json`:

```json
{
	"extends": "../../tsconfig.base.json",
	"compilerOptions": {
		"types": ["bun-types"],
		"rootDir": ".",
		"noEmit": true
	},
	"include": ["src/**/*.ts", "test/**/*.ts"]
}
```

- [ ] **Step 5: Create state types**

Create `packages/configurator/src/types.ts`:

```typescript
export type DashboardTabId = "providers" | "models" | "theme" | "extensions" | "mcp" | "system";
export type ProviderConnectionState = "configured" | "connected" | "failed" | "missing";

export interface ProviderSummary {
	id: string;
	name: string;
	connectionState: ProviderConnectionState;
	baseUrl?: string;
	modelCount: number;
	assignedRoles: string[];
	apiKeyConfigured: boolean;
}

export interface ModelSummary {
	id: string;
	name: string;
	provider: string;
	available: boolean;
	roles: string[];
	capabilities: string[];
}

export interface RoleAssignment {
	role: string;
	modelId: string;
	provider: string;
}

export interface ExtensionSummary {
	id: string;
	name: string;
	description: string;
	enabled: boolean;
}

export interface McpServerSummary {
	name: string;
	command: string;
	args: string[];
	envCount: number;
}

export interface ConfigState {
	agentDir: string;
	configPath: string;
	version: string;
	providers: ProviderSummary[];
	models: ModelSummary[];
	roles: RoleAssignment[];
	theme: string;
	extensions: ExtensionSummary[];
	mcpServers: McpServerSummary[];
	dirty: boolean;
}

export interface ConfigChange {
	path: string;
	before: unknown;
	after: unknown;
}

export interface DashboardOptions {
	initialTab?: DashboardTabId;
	onSave?: () => void | Promise<void>;
	onQuit?: () => void;
}
```

- [ ] **Step 6: Create minimal dashboard and export**

Create `packages/configurator/src/dashboard/index.ts`:

```typescript
import type { Component } from "@oh-my-pi/pi-tui";
import type { ConfigState, DashboardOptions, DashboardTabId } from "../types";

const TABS: readonly { id: DashboardTabId; label: string }[] = [
	{ id: "providers", label: "Providers" },
	{ id: "models", label: "Models" },
	{ id: "theme", label: "Theme" },
	{ id: "extensions", label: "Extensions" },
	{ id: "mcp", label: "MCP" },
	{ id: "system", label: "System" },
];

function clamp(line: string, width: number): string {
	return line.length > width ? line.slice(0, width) : line;
}

export class Dashboard implements Component {
	#state: ConfigState;
	#activeTab: DashboardTabId;
	#options: DashboardOptions;

	constructor(state: ConfigState, options: DashboardOptions = {}) {
		this.#state = state;
		this.#activeTab = options.initialTab ?? "providers";
		this.#options = options;
	}

	handleInput(data: string): void {
		if (data === "\t") this.#selectRelativeTab(1);
		if (data === "\x13") void this.#options.onSave?.();
		if (data === "\x11") this.#options.onQuit?.();
	}

	#selectRelativeTab(delta: number): void {
		const current = TABS.findIndex(tab => tab.id === this.#activeTab);
		this.#activeTab = TABS[(current + delta + TABS.length) % TABS.length].id;
	}

	render(width: number): readonly string[] {
		const tabLine = TABS.map(tab => (tab.id === this.#activeTab ? `[${tab.label}]` : ` ${tab.label} `)).join(" ");
		const status = `omp ${this.#state.version} | ${this.#state.configPath} | ${this.#state.dirty ? "Unsaved" : "Saved"}`;
		return [clamp(tabLine, width), "─".repeat(width), ...this.#renderActiveTab(width), "─".repeat(width), clamp(status, width)];
	}

	#renderActiveTab(width: number): readonly string[] {
		const title = this.#activeTab[0].toUpperCase() + this.#activeTab.slice(1);
		return [clamp(title, width), clamp("No entries loaded.", width)];
	}
}
```

Create `packages/configurator/src/index.ts`:

```typescript
import { Dashboard } from "./dashboard";
import type { ConfigState, DashboardOptions } from "./types";

export type {
	ConfigChange,
	ConfigState,
	DashboardOptions,
	DashboardTabId,
	ExtensionSummary,
	McpServerSummary,
	ModelSummary,
	ProviderSummary,
	RoleAssignment,
} from "./types";

export function createDashboard(state: ConfigState, options: DashboardOptions = {}): Dashboard {
	return new Dashboard(state, options);
}
```

- [ ] **Step 7: Create CLI skeleton**

Create `packages/configurator/src/cli.ts`:

```typescript
#!/usr/bin/env bun

import { ProcessTerminal, TUI } from "@oh-my-pi/pi-tui";
import { createDashboard } from "./index";
import type { ConfigState } from "./types";

function help(): string {
	return "omp-config\n\nUsage: omp-config [--help] [--version] [--json] [--tab <name>]\n";
}

function bootstrapState(): ConfigState {
	const agentDir = process.env.OMP_CONFIG_DIR ?? "~/.omp/agent";
	return {
		agentDir,
		configPath: `${agentDir}/config.yml`,
		version: "15.13.3",
		providers: [],
		models: [],
		roles: [],
		theme: "default",
		extensions: [],
		mcpServers: [],
		dirty: false,
	};
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
	if (argv.includes("--help") || argv.includes("-h")) {
		process.stdout.write(help());
		return;
	}
	if (argv.includes("--version") || argv.includes("-v")) {
		process.stdout.write("15.13.3\n");
		return;
	}

	const state = bootstrapState();
	if (argv.includes("--json")) {
		process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
		return;
	}

	const tui = new TUI(new ProcessTerminal());
	tui.addChild(createDashboard(state, { onQuit: () => tui.stop() }));
	tui.start();
}

main().catch(error => {
	process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
	process.exitCode = 1;
});
```

- [ ] **Step 8: Verify GREEN**

Run:

```bash
bun --cwd=packages/configurator test test/dashboard.test.ts
bun --cwd=packages/configurator run check:types
```

Expected: both PASS.

- [ ] **Step 9: Commit scaffold**

Run:

```bash
git add packages/configurator
git commit -m "feat(configurator): scaffold standalone TUI package"
```

---

## Task 2: Config reader, diff, and writer

**Files:**
- Create: `packages/configurator/src/config/reader.ts`
- Create: `packages/configurator/src/config/diff.ts`
- Create: `packages/configurator/src/config/writer.ts`
- Modify: `packages/configurator/src/index.ts`
- Test: `packages/configurator/test/config-reader.test.ts`
- Test: `packages/configurator/test/config-writer.test.ts`
- Test: `packages/configurator/test/diff.test.ts`

- [ ] **Step 1: Write failing config tests**

Create `packages/configurator/test/diff.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { diffConfigStates, formatConfigChange } from "../src/config/diff";
import type { ConfigState } from "../src";

function state(overrides: Partial<ConfigState> = {}): ConfigState {
	return { agentDir: "/tmp/a", configPath: "/tmp/a/config.yml", version: "t", providers: [], models: [], roles: [], theme: "default", extensions: [], mcpServers: [], dirty: false, ...overrides };
}

describe("diffConfigStates", () => {
	test("reports theme changes", () => {
		expect(diffConfigStates(state(), state({ theme: "nord" }))).toEqual([{ path: "theme", before: "default", after: "nord" }]);
	});
});

describe("formatConfigChange", () => {
	test("formats scalar changes", () => {
		expect(formatConfigChange({ path: "theme", before: "default", after: "nord" })).toBe("theme: default → nord");
	});
});
```

Create `packages/configurator/test/config-reader.test.ts`:

```typescript
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { readConfigState } from "../src/config/reader";

const dirs: string[] = [];
async function tempDir(): Promise<string> { const dir = await mkdtemp(join(tmpdir(), "omp-config-")); dirs.push(dir); return dir; }
afterEach(async () => { for (const dir of dirs) await rm(dir, { recursive: true, force: true }); dirs.length = 0; });

describe("readConfigState", () => {
	test("returns defaults when config is missing", async () => {
		const agentDir = await tempDir();
		const state = await readConfigState({ agentDir, version: "test" });
		expect(state.theme).toBe("default");
		expect(state.configPath).toBe(join(agentDir, "config.yml"));
		expect(state.dirty).toBe(false);
	});

	test("reads theme and disabled extensions", async () => {
		const agentDir = await tempDir();
		await writeFile(join(agentDir, "config.yml"), "theme: tokyo-night\ndisabledExtensions:\n  - diagnostics\n");
		const state = await readConfigState({ agentDir, version: "test" });
		expect(state.theme).toBe("tokyo-night");
		expect(state.extensions).toEqual([{ id: "diagnostics", name: "diagnostics", description: "Disabled extension", enabled: false }]);
	});
});
```

Create `packages/configurator/test/config-writer.test.ts`:

```typescript
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { writeConfigChanges } from "../src/config/writer";

const dirs: string[] = [];
async function tempDir(): Promise<string> { const dir = await mkdtemp(join(tmpdir(), "omp-config-writer-")); dirs.push(dir); return dir; }
afterEach(async () => { for (const dir of dirs) await rm(dir, { recursive: true, force: true }); dirs.length = 0; });

describe("writeConfigChanges", () => {
	test("creates config.yml when missing", async () => {
		const agentDir = await tempDir();
		await writeConfigChanges({ agentDir, changes: [{ path: "theme", before: "default", after: "nord" }] });
		expect(await readFile(join(agentDir, "config.yml"), "utf8")).toContain("theme: nord");
	});

	test("preserves existing list entries", async () => {
		const agentDir = await tempDir();
		await writeFile(join(agentDir, "config.yml"), "theme: default\ndisabledExtensions:\n  - diagnostics\n");
		await writeConfigChanges({ agentDir, changes: [{ path: "theme", before: "default", after: "nord" }] });
		const written = await readFile(join(agentDir, "config.yml"), "utf8");
		expect(written).toContain("theme: nord");
		expect(written).toContain("  - diagnostics");
	});
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run:

```bash
bun --cwd=packages/configurator test test/config-reader.test.ts test/config-writer.test.ts test/diff.test.ts
```

Expected: FAIL because config modules are missing.

- [ ] **Step 3: Implement config modules**

Create `packages/configurator/src/config/diff.ts`:

```typescript
import type { ConfigChange, ConfigState } from "../types";

export function diffConfigStates(before: ConfigState, after: ConfigState): ConfigChange[] {
	const changes: ConfigChange[] = [];
	if (before.theme !== after.theme) changes.push({ path: "theme", before: before.theme, after: after.theme });
	return changes;
}

export function formatConfigChange(change: ConfigChange): string {
	const before = typeof change.before === "string" ? change.before : JSON.stringify(change.before);
	const after = typeof change.after === "string" ? change.after : JSON.stringify(change.after);
	return `${change.path}: ${before} → ${after}`;
}
```

Create `packages/configurator/src/config/reader.ts`:

```typescript
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ConfigState, ExtensionSummary } from "../types";

export interface ReadConfigStateOptions { agentDir: string; version: string; }

function scalar(source: string, key: string): string | undefined {
	return source.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim().replace(/^['\"]|['\"]$/g, "");
}

function list(source: string, key: string): string[] {
	const lines = source.split(/\r?\n/);
	const start = lines.findIndex(line => line.trim() === `${key}:`);
	if (start === -1) return [];
	const values: string[] = [];
	for (let i = start + 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line.startsWith(" ") && line.trim()) break;
		const value = line.trim().match(/^-\s+(.+)$/)?.[1];
		if (value) values.push(value.trim().replace(/^['\"]|['\"]$/g, ""));
	}
	return values;
}

function disabledExtensions(ids: string[]): ExtensionSummary[] {
	return ids.map(id => ({ id, name: id, description: "Disabled extension", enabled: false }));
}

export async function readConfigState(options: ReadConfigStateOptions): Promise<ConfigState> {
	const configPath = join(options.agentDir, "config.yml");
	let theme = "default";
	let extensions: ExtensionSummary[] = [];
	if (existsSync(configPath)) {
		const source = await readFile(configPath, "utf8");
		theme = scalar(source, "theme") ?? theme;
		extensions = disabledExtensions(list(source, "disabledExtensions"));
	}
	return { agentDir: options.agentDir, configPath, version: options.version, providers: [], models: [], roles: [], theme, extensions, mcpServers: [], dirty: false };
}
```

Create `packages/configurator/src/config/writer.ts`:

```typescript
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ConfigChange } from "../types";

export interface WriteConfigChangesOptions { agentDir: string; changes: readonly ConfigChange[]; }

function setScalar(source: string, key: string, value: string): string {
	const line = `${key}: ${value.includes(":") || value.includes("#") ? JSON.stringify(value) : value}`;
	const pattern = new RegExp(`^${key}:.*$`, "m");
	if (pattern.test(source)) return source.replace(pattern, line);
	return source.trimEnd() ? `${source.trimEnd()}\n${line}\n` : `${line}\n`;
}

export async function writeConfigChanges(options: WriteConfigChangesOptions): Promise<void> {
	await mkdir(options.agentDir, { recursive: true });
	const configPath = join(options.agentDir, "config.yml");
	let source = existsSync(configPath) ? await readFile(configPath, "utf8") : "";
	for (const change of options.changes) {
		if (change.path === "theme" && typeof change.after === "string") source = setScalar(source, "theme", change.after);
	}
	await writeFile(configPath, source, "utf8");
}
```

- [ ] **Step 4: Export config APIs**

Add to `packages/configurator/src/index.ts`:

```typescript
export { diffConfigStates, formatConfigChange } from "./config/diff";
export { readConfigState } from "./config/reader";
export { writeConfigChanges } from "./config/writer";
```

- [ ] **Step 5: Verify GREEN**

Run:

```bash
bun --cwd=packages/configurator test test/config-reader.test.ts test/config-writer.test.ts test/diff.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit config IO**

Run:

```bash
git add packages/configurator/src/config packages/configurator/src/index.ts packages/configurator/test/config-reader.test.ts packages/configurator/test/config-writer.test.ts packages/configurator/test/diff.test.ts
git commit -m "feat(configurator): read write and diff config state"
```

---

## Task 3: Dashboard tab renderers and reusable components

**Files:**
- Create: `packages/configurator/src/components/{provider-card,model-cell,role-router,theme-preview}.ts`
- Create: `packages/configurator/src/dashboard/tabs/{providers,models,theme,extensions,mcp,system}.ts`
- Modify: `packages/configurator/src/dashboard/index.ts`
- Test: `packages/configurator/test/components.test.ts`
- Modify: `packages/configurator/test/dashboard.test.ts`

- [ ] **Step 1: Write failing component tests**

Create `packages/configurator/test/components.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { renderModelCell } from "../src/components/model-cell";
import { renderProviderCard } from "../src/components/provider-card";
import { renderRoleRouter } from "../src/components/role-router";
import { renderThemePreview } from "../src/components/theme-preview";

describe("dashboard render helpers", () => {
	test("renders provider summary", () => {
		const text = renderProviderCard({ id: "anthropic", name: "Anthropic", connectionState: "connected", modelCount: 5, assignedRoles: ["default"], apiKeyConfigured: true }, 80).join("\n");
		expect(text).toContain("Anthropic");
		expect(text).toContain("connected");
		expect(text).toContain("5 models");
	});

	test("renders role routing", () => {
		expect(renderRoleRouter([{ role: "default", provider: "anthropic", modelId: "claude-4" }], 80).join("\n")).toContain("default → anthropic/claude-4");
	});

	test("renders model summary", () => {
		const text = renderModelCell({ id: "claude-4", name: "Claude 4", provider: "anthropic", available: true, roles: ["default"], capabilities: ["reasoning"] }, 80).join("\n");
		expect(text).toContain("Claude 4");
		expect(text).toContain("reasoning");
	});

	test("renders selected theme preview", () => {
		expect(renderThemePreview("tokyo-night", true, 80).join("\n")).toContain("selected");
	});
});
```

- [ ] **Step 2: Add dashboard tab tests**

Append to `packages/configurator/test/dashboard.test.ts`:

```typescript
	test("switches to models tab", () => {
		const dashboard = createDashboard(state());
		dashboard.handleInput?.("\t");
		expect(dashboard.render(100).join("\n")).toContain("[Models]");
	});

	test("renders system tab details", () => {
		const dashboard = createDashboard(state(), { initialTab: "system" });
		expect(dashboard.render(100).join("\n")).toContain("Agent directory");
	});
```

- [ ] **Step 3: Run tests and confirm RED**

Run:

```bash
bun --cwd=packages/configurator test test/components.test.ts test/dashboard.test.ts
```

Expected: FAIL because helper and tab modules are missing.

- [ ] **Step 4: Implement helper components**

Create `packages/configurator/src/components/provider-card.ts`:

```typescript
import type { ProviderSummary } from "../types";
const cut = (line: string, width: number) => (line.length <= width ? line : `${line.slice(0, Math.max(0, width - 1))}…`);
export function renderProviderCard(provider: ProviderSummary, width: number): readonly string[] {
	const roles = provider.assignedRoles.length ? provider.assignedRoles.join(", ") : "no roles";
	return [cut(`${provider.name} (${provider.id}) — ${provider.connectionState}`, width), cut(`  ${provider.modelCount} models | roles: ${roles} | API key: ${provider.apiKeyConfigured ? "configured" : "missing"}`, width)];
}
```

Create `packages/configurator/src/components/role-router.ts`:

```typescript
import type { RoleAssignment } from "../types";
const cut = (line: string, width: number) => (line.length <= width ? line : `${line.slice(0, Math.max(0, width - 1))}…`);
export function renderRoleRouter(roles: readonly RoleAssignment[], width: number): readonly string[] {
	return roles.length ? roles.map(role => cut(`${role.role} → ${role.provider}/${role.modelId}`, width)) : ["No role assignments configured."];
}
```

Create `packages/configurator/src/components/model-cell.ts`:

```typescript
import type { ModelSummary } from "../types";
const cut = (line: string, width: number) => (line.length <= width ? line : `${line.slice(0, Math.max(0, width - 1))}…`);
export function renderModelCell(model: ModelSummary, width: number): readonly string[] {
	const roles = model.roles.length ? model.roles.join(", ") : "no roles";
	const caps = model.capabilities.length ? model.capabilities.join(", ") : "no capabilities";
	return [cut(`${model.name} (${model.id}) — ${model.provider} — ${model.available ? "available" : "unavailable"}`, width), cut(`  roles: ${roles} | capabilities: ${caps}`, width)];
}
```

Create `packages/configurator/src/components/theme-preview.ts`:

```typescript
const cut = (line: string, width: number) => (line.length <= width ? line : `${line.slice(0, Math.max(0, width - 1))}…`);
export function renderThemePreview(theme: string, selected: boolean, width: number): readonly string[] {
	return [cut(`${theme} — ${selected ? "selected" : "available"}`, width), cut("  sample: prompt tool result diff", width)];
}
```

- [ ] **Step 5: Implement tab renderers**

Create `packages/configurator/src/dashboard/tabs/providers.ts`:

```typescript
import { renderProviderCard } from "../../components/provider-card";
import { renderRoleRouter } from "../../components/role-router";
import type { ConfigState } from "../../types";
export function renderProvidersTab(state: ConfigState, width: number): readonly string[] {
	const lines = ["Providers", ""];
	if (state.providers.length) for (const provider of state.providers) lines.push(...renderProviderCard(provider, width), "");
	else lines.push("No providers configured.", "Press n to add a provider.");
	lines.push("", "Role routing", ...renderRoleRouter(state.roles, width));
	return lines;
}
```

Create `packages/configurator/src/dashboard/tabs/models.ts`:

```typescript
import { renderModelCell } from "../../components/model-cell";
import type { ConfigState } from "../../types";
export function renderModelsTab(state: ConfigState, width: number): readonly string[] {
	const lines = ["Models", ""];
	if (!state.models.length) return [...lines, "No models discovered."];
	for (const model of state.models) lines.push(...renderModelCell(model, width), "");
	return lines;
}
```

Create `packages/configurator/src/dashboard/tabs/theme.ts`:

```typescript
import { renderThemePreview } from "../../components/theme-preview";
import type { ConfigState } from "../../types";
const THEMES = ["default", "catppuccin-mocha", "tokyo-night", "nord", "gruvbox-dark"] as const;
export function renderThemeTab(state: ConfigState, width: number): readonly string[] {
	return ["Theme", "", ...THEMES.flatMap(theme => [...renderThemePreview(theme, theme === state.theme, width), ""] )];
}
```

Create `packages/configurator/src/dashboard/tabs/extensions.ts`:

```typescript
import type { ConfigState } from "../../types";
const cut = (line: string, width: number) => (line.length <= width ? line : `${line.slice(0, Math.max(0, width - 1))}…`);
export function renderExtensionsTab(state: ConfigState, width: number): readonly string[] {
	const lines = ["Extensions", ""];
	if (!state.extensions.length) return [...lines, "No extension overrides configured."];
	return [...lines, ...state.extensions.map(ext => cut(`${ext.enabled ? "[x]" : "[ ]"} ${ext.name} — ${ext.description}`, width))];
}
```

Create `packages/configurator/src/dashboard/tabs/mcp.ts`:

```typescript
import type { ConfigState } from "../../types";
const cut = (line: string, width: number) => (line.length <= width ? line : `${line.slice(0, Math.max(0, width - 1))}…`);
export function renderMcpTab(state: ConfigState, width: number): readonly string[] {
	const lines = ["MCP", ""];
	if (!state.mcpServers.length) return [...lines, "No MCP servers configured.", "Press n to add a server."];
	return [...lines, ...state.mcpServers.flatMap(server => [cut(`${server.name} — ${server.command} ${server.args.join(" ")}`, width), cut(`  environment variables: ${server.envCount}`, width)])];
}
```

Create `packages/configurator/src/dashboard/tabs/system.ts`:

```typescript
import type { ConfigState } from "../../types";
export function renderSystemTab(state: ConfigState, width: number): readonly string[] {
	return ["System", "", `Agent directory: ${state.agentDir}`, `Config path: ${state.configPath}`, `Version: ${state.version}`, `Providers: ${state.providers.length}`, `Models: ${state.models.length}`, `MCP servers: ${state.mcpServers.length}`].map(line => line.length <= width ? line : `${line.slice(0, Math.max(0, width - 1))}…`);
}
```

- [ ] **Step 6: Wire tab renderers into dashboard**

Modify `packages/configurator/src/dashboard/index.ts`:

```typescript
import { renderExtensionsTab } from "./tabs/extensions";
import { renderMcpTab } from "./tabs/mcp";
import { renderModelsTab } from "./tabs/models";
import { renderProvidersTab } from "./tabs/providers";
import { renderSystemTab } from "./tabs/system";
import { renderThemeTab } from "./tabs/theme";
```

Replace `#renderActiveTab(width: number)` with:

```typescript
#renderActiveTab(width: number): readonly string[] {
	switch (this.#activeTab) {
		case "providers": return renderProvidersTab(this.#state, width);
		case "models": return renderModelsTab(this.#state, width);
		case "theme": return renderThemeTab(this.#state, width);
		case "extensions": return renderExtensionsTab(this.#state, width);
		case "mcp": return renderMcpTab(this.#state, width);
		case "system": return renderSystemTab(this.#state, width);
	}
}
```

- [ ] **Step 7: Verify GREEN**

Run:

```bash
bun --cwd=packages/configurator test test/components.test.ts test/dashboard.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit components and tabs**

Run:

```bash
git add packages/configurator/src/components packages/configurator/src/dashboard packages/configurator/test/components.test.ts packages/configurator/test/dashboard.test.ts
git commit -m "feat(configurator): render dashboard tabs"
```

---

## Task 4: Real CLI config loading, save flow, and README

**Files:**
- Create: `packages/configurator/src/utils/omp.ts`
- Modify: `packages/configurator/src/cli.ts`
- Create: `packages/configurator/README.md`
- Modify: `packages/configurator/test/config-reader.test.ts`
- Modify: `packages/configurator/test/dashboard.test.ts`

- [ ] **Step 1: Add failing utility and save tests**

Append to `packages/configurator/test/config-reader.test.ts`:

```typescript
import { resolveAgentDir } from "../src/utils/omp";

describe("resolveAgentDir", () => {
	test("uses explicit override", () => {
		expect(resolveAgentDir({ override: "/tmp/custom" })).toBe("/tmp/custom");
	});
	test("uses OMP_CONFIG_DIR", () => {
		expect(resolveAgentDir({ env: { OMP_CONFIG_DIR: "/tmp/env" } as NodeJS.ProcessEnv })).toBe("/tmp/env");
	});
});
```

Append to `packages/configurator/test/dashboard.test.ts`:

```typescript
	test("calls onSave on Ctrl+S", () => {
		let saved = false;
		const dashboard = createDashboard(state({ dirty: true }), { onSave: () => { saved = true; } });
		dashboard.handleInput?.("\x13");
		expect(saved).toBe(true);
	});
```

- [ ] **Step 2: Run tests and confirm RED**

Run:

```bash
bun --cwd=packages/configurator test test/config-reader.test.ts test/dashboard.test.ts
```

Expected: FAIL because `utils/omp` does not exist. Save test should already pass if Task 1 included Ctrl+S handling.

- [ ] **Step 3: Implement omp utility**

Create `packages/configurator/src/utils/omp.ts`:

```typescript
import { homedir } from "node:os";
import { join } from "node:path";

export interface ResolveAgentDirOptions { override?: string; env?: NodeJS.ProcessEnv; }

export function resolveAgentDir(options: ResolveAgentDirOptions = {}): string {
	if (options.override) return options.override;
	const env = options.env ?? process.env;
	if (env.OMP_CONFIG_DIR) return env.OMP_CONFIG_DIR;
	return join(homedir(), ".omp", "agent");
}

export function resolveConfiguratorVersion(): string {
	return "15.13.3";
}
```

- [ ] **Step 4: Make CLI use reader/writer/diff**

Modify `packages/configurator/src/cli.ts`:

```typescript
#!/usr/bin/env bun

import { ProcessTerminal, TUI } from "@oh-my-pi/pi-tui";
import { diffConfigStates } from "./config/diff";
import { readConfigState } from "./config/reader";
import { writeConfigChanges } from "./config/writer";
import { createDashboard } from "./index";
import { resolveAgentDir, resolveConfiguratorVersion } from "./utils/omp";

function help(): string {
	return "omp-config\n\nUsage: omp-config [--help] [--version] [--json] [--tab <name>]\n";
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
	if (argv.includes("--help") || argv.includes("-h")) { process.stdout.write(help()); return; }
	if (argv.includes("--version") || argv.includes("-v")) { process.stdout.write(`${resolveConfiguratorVersion()}\n`); return; }

	const state = await readConfigState({ agentDir: resolveAgentDir(), version: resolveConfiguratorVersion() });
	const initialState = structuredClone(state);
	if (argv.includes("--json")) { process.stdout.write(`${JSON.stringify(state, null, 2)}\n`); return; }

	const tui = new TUI(new ProcessTerminal());
	tui.addChild(createDashboard(state, {
		onSave: async () => {
			await writeConfigChanges({ agentDir: state.agentDir, changes: diffConfigStates(initialState, state) });
			state.dirty = false;
			tui.requestRender();
		},
		onQuit: () => tui.stop(),
	}));
	tui.start();
}

main().catch(error => {
	process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
	process.exitCode = 1;
});
```

- [ ] **Step 5: Create README**

Create `packages/configurator/README.md`:

```markdown
# @oh-my-pi/omp-configurator

Standalone terminal configuration dashboard for omp.

## Usage

```sh
bunx @oh-my-pi/omp-configurator
omp-config --help
omp-config --json
```

## Configuration areas

- Providers and connection summaries
- Models and role routing
- Theme previews
- Extension enable/disable overrides
- MCP server summaries
- System config paths and health

`omp-config` reads and writes the same `~/.omp/agent/config.yml` used by `omp`.
```

- [ ] **Step 6: Verify CLI and tests**

Run:

```bash
bun --cwd=packages/configurator test
bun --cwd=packages/configurator src/cli.ts --help
bun --cwd=packages/configurator src/cli.ts --version
bun --cwd=packages/configurator src/cli.ts --json
```

Expected: tests PASS; help includes `omp-config`; version prints `15.13.3`; JSON includes `agentDir` and `configPath`.

- [ ] **Step 7: Commit CLI integration**

Run:

```bash
git add packages/configurator
git commit -m "feat(configurator): load and save omp config from CLI"
```

---

## Task 5: Final verification

**Files:**
- Modify only files under `packages/configurator` if verification finds issues.

- [ ] **Step 1: Run package tests**

Run:

```bash
bun --cwd=packages/configurator test
```

Expected: PASS.

- [ ] **Step 2: Run typecheck and lint package**

Run:

```bash
bun --cwd=packages/configurator run check
```

Expected: PASS.

- [ ] **Step 3: Run CLI smoke checks**

Run:

```bash
bun packages/configurator/src/cli.ts --help
bun packages/configurator/src/cli.ts --version
bun packages/configurator/src/cli.ts --json
```

Expected: all commands exit 0 and print valid output.

- [ ] **Step 4: Run root tool check**

Run:

```bash
bun run check:tools
```

Expected: PASS.

- [ ] **Step 5: Commit verification fixes if any**

If Step 1-4 required fixes, run:

```bash
git add packages/configurator
git commit -m "fix(configurator): address verification findings"
```

If no files changed, do not create an empty commit.

---

## Self-Review

Spec coverage:
- Standalone package and `omp-config` binary: Task 1.
- Shared state types and public API: Task 1.
- Config read/diff/write: Task 2.
- Dashboard shell, tab switching, status, save callback: Tasks 1 and 4.
- Providers, models, theme, extensions, MCP, system tabs: Task 3.
- CLI real config loading and save flow: Task 4.
- README and verification: Tasks 4 and 5.

Deliberate scope boundary:
- This plan ships the standalone dashboard foundation, config IO, tab renderers, and CLI. Network-backed provider connection tests, interactive add-provider dialogs, and in-running-omp slash-command overlay integration are left for a second plan after the standalone dashboard is working and verified.

Placeholder scan:
- No TBD/TODO placeholders.
- Every code-changing step includes concrete file content or exact replacement text.

Type consistency:
- `ConfigState`, `ConfigChange`, `DashboardOptions`, and renderer helper names are defined once and reused consistently.
