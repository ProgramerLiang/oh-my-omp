import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { YAML } from "bun";
import { writeConfigChanges, writeConfigStateFull } from "../src";

const dirs: string[] = [];

async function tempDir(): Promise<string> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "omp-config-writer-"));
	dirs.push(dir);
	return dir;
}

afterEach(async () => {
	for (const dir of dirs) {
		await fs.rm(dir, { recursive: true, force: true });
	}
	dirs.length = 0;
});

describe("writeConfigChanges", () => {
	test("creates config.yml when missing", async () => {
		const agentDir = await tempDir();

		await writeConfigChanges({
			agentDir,
			changes: [{ path: "theme", before: "default", after: "nord" }],
		});

		expect(
			await fs.readFile(path.join(agentDir, "config.yml"), "utf8"),
		).toContain("theme: nord");
	});

	test("updates theme and preserves existing list entries", async () => {
		const agentDir = await tempDir();
		await fs.writeFile(
			path.join(agentDir, "config.yml"),
			"theme: default\ndisabledExtensions:\n  - diagnostics\n",
		);

		await writeConfigChanges({
			agentDir,
			changes: [{ path: "theme", before: "default", after: "nord" }],
		});

		const written = YAML.parse(
			await fs.readFile(path.join(agentDir, "config.yml"), "utf8"),
		) as Record<string, unknown>;
		expect(written.theme).toBe("nord");
		expect(written.disabledExtensions).toEqual(["diagnostics"]);
	});
});

describe("writeConfigStateFull", () => {
	test("saves provider settings, models, disabled models, and theme object", async () => {
		const agentDir = await tempDir();
		await fs.writeFile(
			path.join(agentDir, "config.yml"),
			"theme:\n  dark: light\n  light: light\n",
		);
		await fs.writeFile(
			path.join(agentDir, "models.yml"),
			"providers:\n  old:\n    baseUrl: https://old.example\n    api: openai-chat\n    apiKey: old-secret\n    models:\n      - id: old-model\n        name: Old Model\n        input:\n          - text\n        maxTokens: 1024\n",
		);

		await writeConfigStateFull({
			agentDir,
			configPath: path.join(agentDir, "config.yml"),
			version: "0.0.0-test",
			providers: [
				{
					id: "old",
					name: "old",
					connectionState: "configured",
					baseUrl: "https://new.example",
					modelCount: 1,
					assignedRoles: [],
					apiKeyConfigured: true,
					apiFormat: "anthropic-messages",
					apiKeyOverride: "new-secret",
				},
			],
			models: [
				{
					id: "new-model",
					name: "New Model",
					provider: "old",
					available: true,
					roles: [],
					capabilities: ["text", "image"],
					maxTokens: 4096,
					contextWindow: 128000,
				},
			],
			roles: [],
			theme: "nord",
			extensions: [],
			mcpServers: [],
			dirty: true,
			disabledModels: ["old/new-model"],
		});

		const config = YAML.parse(
			await fs.readFile(path.join(agentDir, "config.yml"), "utf8"),
		) as Record<string, unknown>;
		const theme = config.theme as Record<string, unknown>;
		expect(theme.dark).toBe("nord");
		expect(theme.light).toBe("light");
		expect(config.disabledModels).toEqual(["old/new-model"]);

		const models = YAML.parse(
			await fs.readFile(path.join(agentDir, "models.yml"), "utf8"),
		) as Record<string, unknown>;
		const providers = models.providers as Record<
			string,
			Record<string, unknown>
		>;
		const provider = providers.old;
		expect(provider).toBeDefined();
		if (!provider) return;
		expect(provider.baseUrl).toBe("https://new.example");
		expect(provider.api).toBe("anthropic-messages");
		expect(provider.apiKey).toBe("new-secret");
		expect(provider.models).toEqual([
			{
				id: "new-model",
				name: "New Model",
				input: ["text", "image"],
				maxTokens: 4096,
				contextWindow: 128000,
			},
		]);
	});
});
