import { describe, expect, test } from "bun:test";
import type { ConfigState } from "../src";
import { diffConfigStates, formatConfigChange } from "../src";

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

describe("diffConfigStates", () => {
	test("reports theme changes", () => {
		expect(diffConfigStates(state(), state({ theme: "nord" }))).toEqual([
			{ path: "theme", before: "default", after: "nord" },
		]);
	});

	test("omits unchanged theme", () => {
		expect(diffConfigStates(state(), state())).toEqual([]);
	});
});

describe("formatConfigChange", () => {
	test("formats scalar changes", () => {
		expect(
			formatConfigChange({ path: "theme", before: "default", after: "nord" }),
		).toBe("theme: default → nord");
	});
});
