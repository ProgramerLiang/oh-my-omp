import * as path from "node:path";
import { YAML } from "bun";
import type { ConfigChange, ConfigState } from "../types";

export interface WriteConfigChangesOptions {
	agentDir: string;
	changes: readonly ConfigChange[];
}

type YamlRecord = Record<string, unknown>;

async function readYamlRecord(filePath: string): Promise<YamlRecord> {
	try {
		const parsed = YAML.parse(await Bun.file(filePath).text());
		return parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? (parsed as YamlRecord)
			: {};
	} catch {
		return {};
	}
}

async function backupFile(filePath: string): Promise<void> {
	try {
		const source = Bun.file(filePath);
		if (!(await source.exists())) return;
		const bakPath = `${filePath}.bak`;
		await Bun.write(bakPath, source);
	} catch {
		// backup is best-effort; never fail the save because of it
	}
}

function asRecord(value: unknown): YamlRecord {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as YamlRecord)
		: {};
}

function writeTheme(doc: YamlRecord, theme: string): void {
	const current = doc.theme;
	if (current && typeof current === "object" && !Array.isArray(current)) {
		const themeDoc = current as YamlRecord;
		themeDoc.dark = theme;
		if (typeof themeDoc.light !== "string") themeDoc.light = theme;
		doc.theme = themeDoc;
		return;
	}
	doc.theme = theme;
}

function writeDisabledModels(
	doc: YamlRecord,
	disabledModels: readonly string[],
): void {
	doc.disabledModels = [...disabledModels].sort();
}

export async function writeConfigChanges(
	options: WriteConfigChangesOptions,
): Promise<void> {
	const configPath = path.join(options.agentDir, "config.yml");
	const doc = await readYamlRecord(configPath);

	for (const change of options.changes) {
		if (change.path === "theme" && typeof change.after === "string") {
			writeTheme(doc, change.after);
		}
		if (change.path === "disabledModels" && Array.isArray(change.after)) {
			writeDisabledModels(
				doc,
				change.after.filter((v) => typeof v === "string"),
			);
		}
	}

	await Bun.write(configPath, YAML.stringify(doc));
}

export async function writeConfigStateFull(state: ConfigState): Promise<void> {
	// Backup existing files before overwriting
	await backupFile(path.join(state.agentDir, "config.yml"));
	await backupFile(path.join(state.agentDir, "models.yml"));

	const configPath = path.join(state.agentDir, "config.yml");
	const configDoc = await readYamlRecord(configPath);
	writeTheme(configDoc, state.theme);
	writeDisabledModels(configDoc, state.disabledModels);
	await Bun.write(configPath, YAML.stringify(configDoc));

	const modelsPath = path.join(state.agentDir, "models.yml");
	const modelsDoc = await readYamlRecord(modelsPath);
	const providersDoc = asRecord(modelsDoc.providers);
	modelsDoc.providers = providersDoc;

	for (const provider of state.providers) {
		const providerDoc = asRecord(providersDoc[provider.id]);
		providersDoc[provider.id] = providerDoc;

		if (provider.baseUrl === undefined) delete providerDoc.baseUrl;
		else providerDoc.baseUrl = provider.baseUrl;
		providerDoc.api = provider.apiFormat;
		if (provider.apiKeyOverride !== undefined)
			providerDoc.apiKey = provider.apiKeyOverride;

		const existingModels = new Map<string, YamlRecord>();
		const rawModels = Array.isArray(providerDoc.models)
			? providerDoc.models
			: [];
		for (const raw of rawModels) {
			const modelDoc = asRecord(raw);
			if (typeof modelDoc.id === "string")
				existingModels.set(modelDoc.id, modelDoc);
		}

		providerDoc.models = state.models
			.filter((model) => model.provider === provider.id)
			.map((model) => {
				const existing = existingModels.get(model.id) ?? {};
				existing.id = model.id;
				existing.name = model.name;
				if (model.capabilities.length > 0) existing.input = model.capabilities;
				if (model.maxTokens !== undefined) existing.maxTokens = model.maxTokens;
				if (model.contextWindow !== undefined)
					existing.contextWindow = model.contextWindow;
				return existing;
			});
	}

	await Bun.write(modelsPath, YAML.stringify(modelsDoc));
}
