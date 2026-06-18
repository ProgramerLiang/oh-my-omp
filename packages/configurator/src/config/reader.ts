import * as path from "node:path";
import { YAML } from "bun";
import type {
	ConfigState,
	ExtensionSummary,
	ModelSummary,
	ProviderSummary,
	RoleAssignment,
} from "../types";

export interface ReadConfigStateOptions {
	agentDir: string;
	version: string;
}

type ConfigDocument = Record<string, unknown>;

function isEnoent(error: unknown): boolean {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function asConfigDocument(value: unknown): ConfigDocument {
	if (value && typeof value === "object" && !Array.isArray(value))
		return value as ConfigDocument;
	return {};
}

async function readConfigDocument(configPath: string): Promise<ConfigDocument> {
	try {
		return asConfigDocument(YAML.parse(await Bun.file(configPath).text()));
	} catch (error) {
		if (isEnoent(error)) return {};
		throw error;
	}
}

function _maskApiKey(apiKey: string): string {
	if (!apiKey || apiKey.length < 8) return "***";
	return `${apiKey.slice(0, 4)}${"*".repeat(apiKey.length - 8)}${apiKey.slice(-4)}`;
}

async function readModelsState(
	agentDir: string,
): Promise<{ providers: ProviderSummary[]; models: ModelSummary[] }> {
	const modelsPath = path.join(agentDir, "models.yml");
	const modelsJsonPath = path.join(agentDir, "models.json");
	let doc: ConfigDocument;

	try {
		doc = asConfigDocument(YAML.parse(await Bun.file(modelsPath).text()));
	} catch {
		try {
			const json = await Bun.file(modelsJsonPath).json();
			doc = asConfigDocument(json);
		} catch {
			return { providers: [], models: [] };
		}
	}

	const providersDoc = asConfigDocument(doc.providers);
	const providerIds = Object.keys(providersDoc);
	const providers: ProviderSummary[] = [];
	const models: ModelSummary[] = [];

	for (const id of providerIds) {
		const providerDoc = asConfigDocument(providersDoc[id]);
		const apiKeyRaw =
			typeof providerDoc.apiKey === "string" ? providerDoc.apiKey : "";
		const apiKeyConfigured = apiKeyRaw.length > 0;
		const baseUrl =
			typeof providerDoc.baseUrl === "string" ? providerDoc.baseUrl : undefined;
		const modelsList = Array.isArray(providerDoc.models)
			? (providerDoc.models as Record<string, unknown>[])
			: [];

		const modelEntries: ModelSummary[] = [];
		for (const m of modelsList) {
			if (typeof m.id !== "string") continue;
			modelEntries.push({
				id: m.id,
				name: typeof m.name === "string" ? m.name : m.id,
				provider: id,
				available: true,
				roles: [],
				capabilities: (Array.isArray(m.input) ? m.input : []).map((v) =>
					String(v),
				),
				maxTokens: typeof m.maxTokens === "number" ? m.maxTokens : undefined,
				contextWindow:
					typeof m.contextWindow === "number" ? m.contextWindow : undefined,
			});
		}

		models.push(...modelEntries);

		providers.push({
			id,
			name: id,
			connectionState: apiKeyConfigured ? "configured" : "missing",
			baseUrl,
			modelCount: modelEntries.length,
			assignedRoles: [],
			apiKeyConfigured,
			apiFormat:
				typeof providerDoc.api === "string"
					? providerDoc.api
					: "openai-responses",
		});
	}

	return { providers, models };
}

function readRoles(config: ConfigDocument): RoleAssignment[] {
	const modelRoles = asConfigDocument(config.modelRoles);
	return Object.entries(modelRoles)
		.filter(([, value]) => typeof value === "string")
		.map(([role, value]) => {
			const parts = (value as string).split("/");
			const modelId =
				parts.length >= 2 ? parts.slice(1).join("/") : (value as string);
			const provider = parts.length >= 2 ? (parts[0] ?? "unknown") : "unknown";
			return { role, provider, modelId };
		});
}

export async function readConfigState(
	options: ReadConfigStateOptions,
): Promise<ConfigState> {
	const configPath = path.join(options.agentDir, "config.yml");
	const config = await readConfigDocument(configPath);

	// Theme is an object { dark, light } or a string
	const themeDoc = config.theme;
	const theme =
		typeof themeDoc === "string"
			? themeDoc
			: (asConfigDocument(themeDoc).dark ?? "default");

	const extensions: ExtensionSummary[] = [];
	if (Array.isArray(config.disabledExtensions)) {
		for (const id of config.disabledExtensions) {
			if (typeof id === "string")
				extensions.push({
					id,
					name: id,
					description: "Disabled extension",
					enabled: false,
				});
		}
	}

	const { providers, models } = await readModelsState(options.agentDir);
	const roles = readRoles(config);

	// Assign roles to providers
	const roleByProvider = new Map<string, string[]>();
	for (const role of roles) {
		const list = roleByProvider.get(role.provider) ?? [];
		list.push(role.role);
		roleByProvider.set(role.provider, list);
	}
	for (const provider of providers) {
		provider.assignedRoles = roleByProvider.get(provider.id) ?? [];
	}
	// Assign roles to models
	for (const model of models) {
		model.roles = roles
			.filter((r) => r.modelId === model.id)
			.map((r) => r.role);
	}

	return {
		agentDir: options.agentDir,
		configPath,
		version: options.version,
		providers,
		models,
		roles,
		theme: String(theme),
		extensions,
		mcpServers: [],
		dirty: false,
		disabledModels: Array.isArray(config.disabledModels)
			? (config.disabledModels as string[]).filter((v) => typeof v === "string")
			: [],
	};
}
