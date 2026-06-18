import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { readConfigState, resolveAgentDir } from "../src";

const dirs: string[] = [];

async function tempDir(): Promise<string> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "omp-config-reader-"));
	dirs.push(dir);
	return dir;
}

afterEach(async () => {
	for (const dir of dirs) {
		await fs.rm(dir, { recursive: true, force: true });
	}
	dirs.length = 0;
});

describe("readConfigState", () => {
	test("returns defaults when config is missing", async () => {
		const agentDir = await tempDir();

		const state = await readConfigState({ agentDir, version: "0.0.0-test" });

		expect(state).toMatchObject({
			agentDir,
			configPath: path.join(agentDir, "config.yml"),
			version: "0.0.0-test",
			theme: "default",
			dirty: false,
		});
		expect(state.extensions).toEqual([]);
	});

	test("reads theme and disabled extensions", async () => {
		const agentDir = await tempDir();
		await fs.writeFile(
			path.join(agentDir, "config.yml"),
			"theme: tokyo-night\ndisabledExtensions:\n  - diagnostics\n  - telemetry\n",
		);

		const state = await readConfigState({ agentDir, version: "0.0.0-test" });

		expect(state.theme).toBe("tokyo-night");
		expect(state.extensions).toEqual([
			{
				id: "diagnostics",
				name: "diagnostics",
				description: "Disabled extension",
				enabled: false,
			},
			{
				id: "telemetry",
				name: "telemetry",
				description: "Disabled extension",
				enabled: false,
			},
		]);
	});
});

describe("resolveAgentDir", () => {
	test("uses override when provided", () => {
		expect(resolveAgentDir({ override: "/custom/path" })).toBe("/custom/path");
	});

	test("uses OMP_CONFIG_DIR env var when no override", () => {
		expect(resolveAgentDir({ env: { OMP_CONFIG_DIR: "/env/path" } })).toBe(
			"/env/path",
		);
	});

	test("falls back to ~/.omp/agent when neither override nor env", () => {
		const result = resolveAgentDir();
		expect(result).toContain(".omp");
		expect(result).toContain("agent");
	});

	test("override takes precedence over env", () => {
		expect(
			resolveAgentDir({
				override: "/override",
				env: { OMP_CONFIG_DIR: "/env" },
			}),
		).toBe("/override");
	});
});
