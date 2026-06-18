import { describe, expect, test } from "bun:test";
import * as os from "node:os";
import type { ConfigState, ProviderSummary } from "../src";
import { createDashboard } from "../src";

function provider(overrides: Partial<ProviderSummary> = {}): ProviderSummary {
	return {
		id: "test",
		name: "Test",
		connectionState: "configured",
		baseUrl: "https://api.example.test",
		modelCount: 1,
		assignedRoles: ["default"],
		apiKeyConfigured: true,
		apiFormat: "openai-responses",
		...overrides,
	};
}

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
		disabledModels: [],
		...overrides,
	};
}

describe("Dashboard", () => {
	test("renders the bordered frame with tab names", () => {
		const text = Bun.stripANSI(createDashboard(state()).render(100).join("\n"));
		expect(text).toContain("Providers");
		expect(text).toContain("Models");
		expect(text).toContain("Theme");
		expect(text).toContain("System");
		expect(text).toContain("Configuration");
		expect(text).toContain("├");
		expect(text).toContain("└");
	});

	test("switches to system tab via initialTab", () => {
		const home = os.homedir();
		const dashboard = createDashboard(
			state({
				agentDir: `${home}/.omp`,
				configPath: `${home}/.omp/config.yml`,
			}),
			{ initialTab: "system" },
		);
		const text = Bun.stripANSI(dashboard.render(100).join("\n"));
		expect(text).toContain("Config path");
		expect(text).toContain("~/.omp");
	});

	test("renders provider data when configured", () => {
		const dashboard = createDashboard(
			state({ providers: [provider({ modelCount: 3 })] }),
			{ initialTab: "providers" },
		);
		const text = Bun.stripANSI(dashboard.render(100).join("\n"));
		expect(text).toContain("test");
		expect(text).toContain("openai-responses");
		expect(text).toContain("3 models");
	});

	test("opens provider detail and cycles api format", () => {
		const appState = state({ providers: [provider()] });
		const dashboard = createDashboard(appState, { initialTab: "providers" });

		dashboard.handleInput("e");
		expect(Bun.stripANSI(dashboard.render(100).join("\n"))).toContain(
			"Base URL",
		);
		dashboard.handleInput("\x1b[B");
		dashboard.handleInput("\r");

		expect(appState.providers[0]?.apiFormat).toBe("openai-chat");
		expect(appState.dirty).toBe(true);
	});

	test("deletes selected provider model with x", () => {
		const appState = state({
			providers: [provider()],
			models: [
				{
					id: "one",
					name: "One",
					provider: "test",
					available: true,
					roles: [],
					capabilities: ["text"],
					maxTokens: 4096,
					contextWindow: 128000,
				},
			],
		});
		const dashboard = createDashboard(appState, { initialTab: "providers" });

		dashboard.handleInput("e");
		dashboard.handleInput("\x1b[B");
		dashboard.handleInput("\x1b[B");
		dashboard.handleInput("\x1b[B");
		dashboard.handleInput("x");
		dashboard.handleInput("x");

		expect(appState.models).toHaveLength(0);
		expect(appState.dirty).toBe(true);
	});

	test("adds a model to provider with a", () => {
		const appState = state({ providers: [provider()] });
		const dashboard = createDashboard(appState, { initialTab: "providers" });

		dashboard.handleInput("e");
		dashboard.handleInput("a");

		expect(appState.models).toHaveLength(1);
		expect(appState.models[0]?.provider).toBe("test");
		expect(Bun.stripANSI(dashboard.render(100).join("\n"))).toContain(
			"Model ID",
		);
		dashboard.handleInput("\x1b[B");
		dashboard.handleInput("\r");
		dashboard.handleInput(" Custom");
		dashboard.handleInput("\r");
		expect(appState.models[0]?.name.endsWith(" Custom")).toBe(true);
		expect(appState.dirty).toBe(true);
	});

	test("renders model data when configured", () => {
		const dashboard = createDashboard(
			state({
				models: [
					{
						id: "claude-4",
						name: "Claude 4",
						provider: "anthropic",
						available: true,
						roles: ["default"],
						capabilities: ["reasoning"],
					},
				],
			}),
			{ initialTab: "models" },
		);
		const text = Bun.stripANSI(dashboard.render(100).join("\n"));
		expect(text).toContain("Claude 4");
		expect(text).toContain("anthropic");
	});

	test("toggles model enabled state", () => {
		const appState = state({
			models: [
				{
					id: "claude-4",
					name: "Claude 4",
					provider: "anthropic",
					available: true,
					roles: [],
					capabilities: ["text"],
				},
			],
		});
		const dashboard = createDashboard(appState, { initialTab: "models" });

		dashboard.handleInput("\r");

		expect(appState.disabledModels).toContain("anthropic/claude-4");
		expect(appState.dirty).toBe(true);
	});

	test("quits through ctrl-q", () => {
		let quit = false;
		const dashboard = createDashboard(state(), {
			onQuit: () => {
				quit = true;
			},
		});

		dashboard.handleInput("\x11");

		expect(quit).toBe(true);
	});

	test("renders dirty/unsaved status hint", () => {
		const dashboard = createDashboard(state({ dirty: true }));
		const text = Bun.stripANSI(dashboard.render(100).join("\n"));
		expect(text).toContain("Ctrl+S");
	});
});
