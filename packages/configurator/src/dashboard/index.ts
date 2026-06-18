import * as path from "node:path";
import {
	type Component,
	extractPrintableText,
	type SettingItem,
	SettingsList,
	type Tab,
	TabBar,
} from "@oh-my-pi/pi-tui";
import { YAML } from "bun";
import type {
	ConfigState,
	DashboardOptions,
	DashboardTabId,
	ModelSummary,
} from "../types";
import { shortenPath } from "../utils/path";
import {
	bottomBorder,
	divider,
	getSettingsListTheme,
	getTabBarTheme,
	row,
	topBorder,
} from "../utils/theme";

const TABS: Tab[] = [
	{ id: "providers", label: "Providers" },
	{ id: "models", label: "Models" },
	{ id: "theme", label: "Theme" },
	{ id: "extensions", label: "Extensions" },
	{ id: "system", label: "System" },
];

const THEME_NAMES = [
	"default",
	"catppuccin-mocha",
	"tokyo-night",
	"nord",
	"gruvbox-dark",
	"light",
	"dark",
];
const API_FORMATS = [
	"openai-responses",
	"openai-chat",
	"anthropic-messages",
	"gemini",
];
const MAX_TOKENS_VALUES = [
	"1024",
	"2048",
	"4096",
	"8192",
	"16384",
	"32768",
	"65536",
	"131072",
	"200000",
];
const ROLES_HEADING = "roles-heading";
const PROV_HEADING = "prov-heading";
const FETCH_STATUS_ITEM = "fetch-status";

const CONTEXT_WINDOW_VALUES = [
	"8192",
	"16384",
	"32768",
	"65536",
	"128000",
	"200000",
	"400000",
	"1000000",
];

function modelKey(model: { provider: string; id: string }): string {
	return `${model.provider}/${model.id}`;
}

function cloneState(state: ConfigState): ConfigState {
	return structuredClone(state) as ConfigState;
}

function providerKeySet(state: ConfigState): Set<string> {
	return new Set(state.providers.map((provider) => provider.id));
}

function modelKeySet(state: ConfigState): Set<string> {
	return new Set(state.models.map((model) => modelKey(model)));
}

class TextInput implements Component {
	#label: string;
	#value: string;
	#cursor: number;
	#done: (selectedValue?: string) => void;

	constructor(
		label: string,
		currentValue: string,
		done: (selectedValue?: string) => void,
	) {
		this.#label = label;
		this.#value = currentValue;
		this.#cursor = [...currentValue].length;
		this.#done = done;
	}

	handleInput(data: string): void {
		const input = data === "\r" ? "\n" : data;
		if (input === "\x1b") {
			this.#done();
			return;
		}
		if (input === "\n") {
			this.#done(this.#value.trim());
			return;
		}
		if (input === "\x01") {
			this.#cursor = 0;
			return;
		}
		if (input === "\x05") {
			this.#cursor = [...this.#value].length;
			return;
		}
		if (input === "\x15") {
			this.#value = "";
			this.#cursor = 0;
			return;
		}
		if (input === "\x1b[D") {
			this.#cursor = Math.max(0, this.#cursor - 1);
			return;
		}
		if (input === "\x1b[C") {
			this.#cursor = Math.min([...this.#value].length, this.#cursor + 1);
			return;
		}
		if (input === "\x7f" || input === "\b") {
			const chars = [...this.#value];
			if (this.#cursor > 0) {
				chars.splice(this.#cursor - 1, 1);
				this.#cursor--;
				this.#value = chars.join("");
			}
			return;
		}
		if (input === "\x1b[3~") {
			const chars = [...this.#value];
			if (this.#cursor < chars.length) {
				chars.splice(this.#cursor, 1);
				this.#value = chars.join("");
			}
			return;
		}
		const text = extractPrintableText(input);
		if (text !== undefined) {
			const chars = [...this.#value];
			const inserted = [...text];
			chars.splice(this.#cursor, 0, ...inserted);
			this.#cursor += inserted.length;
			this.#value = chars.join("");
		}
	}

	render(width: number): readonly string[] {
		const chars = [...this.#value];
		const rendered = `${chars.slice(0, this.#cursor).join("")}\u258c${chars.slice(this.#cursor).join("")}`;
		const valueWidth = Math.max(1, width - 4);
		const clipped =
			rendered.length > valueWidth ? rendered.slice(-valueWidth) : rendered;
		return [this.#label, `> ${clipped}`];
	}
}

export class Dashboard implements Component {
	#tabBar: TabBar;
	#settingsList: SettingsList | null = null;
	#state: ConfigState;
	#options: DashboardOptions;
	#currentTabId: DashboardTabId = "providers";
	#saveError: string | undefined;
	#editingModelKey: string | null = null;
	#editingProviderKey: string | null = null;
	#statusMessage: string = "";
	#pendingDeleteModelKey: string | null = null;
	#savePreviewOpen = false;
	#lastSavedState: ConfigState;

	constructor(state: ConfigState, options: DashboardOptions = {}) {
		this.#state = state;
		this.#options = options;
		this.#lastSavedState = cloneState(state);

		this.#tabBar = new TabBar("", TABS, getTabBarTheme());
		this.#tabBar.showHint = false;
		this.#tabBar.onTabChange = () => {
			const tabId = this.#tabBar.getActiveTab().id as DashboardTabId;
			this.#pendingDeleteModelKey = null;
			this.#savePreviewOpen = false;
			this.#editingModelKey = null;
			this.#editingProviderKey = null;
			this.#switchToTab(tabId);
		};
		this.#currentTabId = options.initialTab ?? "providers";
		this.#tabBar.setActiveById(this.#currentTabId);
		this.#switchToTab(this.#currentTabId);
	}

	#requestDeleteModel(key: string): void {
		if (this.#pendingDeleteModelKey === key) {
			this.#pendingDeleteModelKey = null;
			this.#deleteModel(key);
			return;
		}
		this.#pendingDeleteModelKey = key;
		this.#statusMessage = `Press x again to delete ${key}`;
		this.#switchToTab(this.#currentTabId);
	}

	#addProvider(): void {
		const existing = providerKeySet(this.#state);
		let index = 1;
		let id = "new-provider";
		while (existing.has(id)) {
			index++;
			id = `new-provider-${index}`;
		}
		this.#state.providers.push({
			id,
			name: id,
			connectionState: "missing",
			modelCount: 0,
			assignedRoles: [],
			apiKeyConfigured: false,
			apiFormat: "openai-responses",
		});
		this.#state.dirty = true;
		this.#editingProviderKey = id;
		this.#statusMessage =
			"New provider created. Edit Base URL and API key before fetching models.";
		this.#switchToTab("providers");
	}

	get state(): ConfigState {
		return this.#state;
	}

	handleInput(data: string): void {
		const input = data === "\r" ? "\n" : data;

		if (this.#savePreviewOpen) {
			if (input === "\x1b" || input === "\x11") {
				this.#savePreviewOpen = false;
				this.#switchToTab(this.#currentTabId);
				return;
			}
			if (input === "\x13") {
				void this.#handleSave();
				return;
			}
			this.#settingsList?.handleInput(input);
			return;
		}

		// Global shortcuts checked before TUI component routing
		if (input === "\x1b" || input === "\x11") {
			if (this.#pendingDeleteModelKey) {
				this.#pendingDeleteModelKey = null;
				this.#statusMessage = "Delete cancelled";
				this.#switchToTab(this.#currentTabId);
				return;
			}
			if (this.#editingModelKey) {
				this.#editingModelKey = null;
				this.#switchToTab(this.#currentTabId);
				return;
			}
			if (this.#editingProviderKey) {
				this.#editingProviderKey = null;
				this.#switchToTab(this.#currentTabId);
				return;
			}
			this.#options.onQuit?.();
			return;
		}

		if (input === "\x13") {
			if (!this.#state.dirty) {
				this.#statusMessage = "No changes to save";
				this.#switchToTab(this.#currentTabId);
				return;
			}
			this.#savePreviewOpen = true;
			this.#switchToTab(this.#currentTabId);
			return;
		}

		if (this.#currentTabId === "providers" && this.#editingProviderKey) {
			// In provider detail view
			if (input === "x" || input === "X") {
				if (this.#pendingDeleteModelKey) {
					this.#deleteModel(this.#pendingDeleteModelKey);
					this.#pendingDeleteModelKey = null;
					return;
				}
				const selected = this.#settingsList?.getSelectedItem();
				if (selected?.id.startsWith("provider-model:")) {
					const modelKeyToDelete = selected.id.slice("provider-model:".length);
					this.#requestDeleteModel(modelKeyToDelete);
				}
				return;
			}
			if (input === "a" || input === "A") {
				void this.#addModelToProvider(this.#editingProviderKey);
				return;
			}
			if (input === "e" || input === "d") {
				const selected = this.#settingsList?.getSelectedItem();
				if (selected?.id.startsWith("provider-model:")) {
					this.#editingModelKey = selected.id.slice("provider-model:".length);
					this.#editingProviderKey = null;
					this.#currentTabId = "models";
					this.#tabBar.setActiveById("models");
					this.#switchToTab("models");
				}
				return;
			}
			if (input === "f" || input === "F") {
				void this.#fetchModelsForProvider(this.#editingProviderKey);
				return;
			}
		}

		// Enter detail views
		if (
			this.#currentTabId === "providers" &&
			this.#editingProviderKey === null &&
			(input === "n" || input === "N" || input === "e" || input === "d")
		) {
			if (input === "n" || input === "N") {
				this.#addProvider();
				return;
			}
			if (input === "e" || input === "d") {
				const selected = this.#settingsList?.getSelectedItem();
				if (selected?.id.startsWith("provider:")) {
					this.#editingProviderKey = selected.id.slice("provider:".length);
					this.#switchToTab("providers");
					return;
				}
			}
		}

		if (
			this.#currentTabId === "models" &&
			this.#editingModelKey === null &&
			(input === "e" || input === "d")
		) {
			const selected = this.#settingsList?.getSelectedItem();
			if (selected?.id.startsWith("model:")) {
				this.#editingModelKey = selected.id.slice("model:".length);
				this.#switchToTab("models");
				return;
			}
		}

		if (this.#currentTabId === "models" && this.#editingModelKey) {
			if (input === "e" || input === "d") {
				this.#editingModelKey = null;
				this.#switchToTab("models");
				return;
			}
		}

		this.#settingsList?.handleInput(input);
		this.#tabBar.handleInput(input);
	}

	#deleteModel(key: string): void {
		const idx = this.#state.models.findIndex((m) => modelKey(m) === key);
		if (idx < 0) return;
		const deleted = this.#state.models.splice(idx, 1)[0];
		this.#state.disabledModels = this.#state.disabledModels.filter(
			(d) => d !== key,
		);
		const provider = deleted
			? this.#state.providers.find((p) => p.id === deleted.provider)
			: undefined;
		if (provider) provider.modelCount = Math.max(0, provider.modelCount - 1);
		this.#state.dirty = true;
		this.#switchToTab(this.#currentTabId);
	}

	async #addModelToProvider(providerKey: string): Promise<void> {
		const suffix = Date.now().toString(36);
		const newModel: ModelSummary = {
			id: `new-model-${suffix}`,
			name: `New Model ${suffix}`,
			provider: providerKey,
			available: true,
			roles: [],
			capabilities: ["text"],
			maxTokens: 4096,
			contextWindow: 128000,
		};
		this.#state.models.push(newModel);
		const provider = this.#state.providers.find((p) => p.id === providerKey);
		if (provider) provider.modelCount++;
		this.#state.dirty = true;
		this.#editingProviderKey = null;
		this.#editingModelKey = modelKey(newModel);
		this.#currentTabId = "models";
		this.#tabBar.setActiveById("models");
		this.#switchToTab("models");
	}

	async #fetchModelsForProvider(providerKey: string): Promise<void> {
		const provider = this.#state.providers.find((p) => p.id === providerKey);
		if (!provider?.baseUrl) {
			this.#statusMessage = "No base URL configured for this provider";
			this.#switchToTab(this.#currentTabId);
			return;
		}

		this.#statusMessage = "Fetching models...";
		this.#switchToTab(this.#currentTabId);

		try {
			// Read apiKey from models.yml
			const modelsPath = path.join(this.#state.agentDir, "models.yml");
			let apiKey = "";
			try {
				const doc = YAML.parse(await Bun.file(modelsPath).text()) as Record<
					string,
					unknown
				>;
				const providersDoc = doc.providers as
					| Record<string, unknown>
					| undefined;
				if (providersDoc) {
					const pDoc = providersDoc[providerKey] as
						| Record<string, unknown>
						| undefined;
					if (pDoc && typeof pDoc.apiKey === "string") apiKey = pDoc.apiKey;
				}
			} catch {
				this.#statusMessage = "Cannot read models.yml for API key";
				this.#switchToTab(this.#currentTabId);
				return;
			}

			if (!apiKey) {
				this.#statusMessage = "No API key found for this provider";
				this.#switchToTab(this.#currentTabId);
				return;
			}

			// Normalize base URL
			let baseUrl = provider.baseUrl.replace(/\/+$/, "");
			if (!baseUrl.startsWith("http")) baseUrl = `https://${baseUrl}`;

			// Determine endpoint and headers based on API format
			let url: string;
			const headers: Record<string, string> = {
				"Content-Type": "application/json",
			};

			switch (provider.apiFormat) {
				case "anthropic-messages": {
					url = `${baseUrl}/v1/models`;
					headers["x-api-key"] = apiKey;
					headers["anthropic-version"] = "2023-06-01";
					break;
				}
				default: {
					// OpenAI-compatible
					url = `${baseUrl}/v1/models`;
					headers.Authorization = `Bearer ${apiKey}`;
					break;
				}
			}

			const response = await fetch(url, {
				headers,
				signal: AbortSignal.timeout(10000),
			});
			if (!response.ok) {
				this.#statusMessage = `API error: ${response.status} ${response.statusText}`;
				this.#switchToTab(this.#currentTabId);
				return;
			}

			const json = (await response.json()) as Record<string, unknown>;
			let fetched: { id: string; model?: string; created?: number }[] = [];

			if (Array.isArray(json.data)) {
				// OpenAI format: { data: [{ id, created, object }] }
				fetched = json.data;
			} else if (Array.isArray(json.models)) {
				// Anthropic format: { models: [{ id, created, name }] }
				fetched = json.models;
			} else {
				this.#statusMessage = "Unrecognized API response format";
				this.#switchToTab(this.#currentTabId);
				return;
			}

			let added = 0;
			const existingKeys = new Set(this.#state.models.map((m) => modelKey(m)));
			for (const raw of fetched) {
				const modelId = raw.id || raw.model;
				if (!modelId) continue;
				const key = `${providerKey}/${modelId}`;
				if (existingKeys.has(key)) continue;

				this.#state.models.push({
					id: modelId,
					name: modelId,
					provider: providerKey,
					available: true,
					roles: [],
					capabilities: ["text"],
					maxTokens: 4096,
					contextWindow: 128000,
				});
				existingKeys.add(key);
				added++;
			}

			if (added > 0) provider.modelCount += added;
			this.#state.dirty = added > 0 || this.#state.dirty;
			this.#statusMessage =
				added > 0 ? `Added ${added} new model(s)` : "No new models found";
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.#statusMessage = message.includes("signal")
				? "Request timed out"
				: `Error: ${message}`;
		}

		this.#switchToTab(this.#currentTabId);
		// Clear status message after 3 seconds
		setTimeout(() => {
			this.#statusMessage = "";
			this.#settingsList?.invalidate();
		}, 3000);
	}

	async #handleSave(): Promise<void> {
		try {
			await this.#options.onSave?.();
			this.#saveError = undefined;
			this.#savePreviewOpen = false;
			this.#lastSavedState = cloneState(this.#state);
			this.#statusMessage = "Saved";
			this.#switchToTab(this.#currentTabId);
		} catch (error) {
			this.#saveError = error instanceof Error ? error.message : String(error);
		}
	}

	invalidate(): void {
		this.#tabBar.invalidate();
		this.#settingsList?.invalidate();
	}

	#switchToTab(tabId: DashboardTabId): void {
		this.#currentTabId = tabId;
		const items = this.#buildItems(tabId);
		this.#settingsList = new SettingsList(
			items,
			12,
			getSettingsListTheme(),
			(id: string, newValue: string) => {
				this.#applyChange(id, newValue);
				this.#switchToTab(tabId);
			},
			() => {
				if (this.#editingModelKey) {
					this.#editingModelKey = null;
					this.#switchToTab(tabId);
				} else if (this.#editingProviderKey) {
					this.#editingProviderKey = null;
					this.#switchToTab(tabId);
				} else {
					this.#options.onQuit?.();
				}
			},
			{ hint: "" },
		);
	}

	#savePreviewItems(): SettingItem[] {
		const changes = this.#summarizeChanges();
		return [
			{
				id: "save-preview-heading",
				label: "Save preview",
				currentValue: "",
				heading: true,
			},
			...(changes.length > 0
				? changes.map((change, index) => ({
						id: `save-preview:${index}`,
						label: `  ${change}`,
						currentValue: "",
					}))
				: [
						{
							id: "save-preview:none",
							label: "  No changes",
							currentValue: "",
						},
					]),
		];
	}

	#summarizeChanges(): string[] {
		const before = this.#lastSavedState;
		const after = this.#state;
		const changes: string[] = [];

		if (before.theme !== after.theme)
			changes.push(`Theme: ${before.theme} → ${after.theme}`);
		if (
			JSON.stringify([...before.disabledModels].sort()) !==
			JSON.stringify([...after.disabledModels].sort())
		) {
			changes.push(
				`Disabled models: ${before.disabledModels.length} → ${after.disabledModels.length}`,
			);
		}

		const beforeP = providerKeySet(before);
		const afterP = providerKeySet(after);
		for (const p of after.providers) {
			const old = before.providers.find((candidate) => candidate.id === p.id);
			if (!beforeP.has(p.id)) changes.push(`Provider added: ${p.id}`);
			if (old) {
				if (old.baseUrl !== p.baseUrl)
					changes.push(`Provider ${p.id} Base URL changed`);
				if (old.apiFormat !== p.apiFormat)
					changes.push(
						`Provider ${p.id} API: ${old.apiFormat} → ${p.apiFormat}`,
					);
				if (p.apiKeyOverride !== undefined)
					changes.push(`Provider ${p.id} API key changed`);
			}
		}
		for (const p of before.providers) {
			if (!afterP.has(p.id)) changes.push(`Provider removed: ${p.id}`);
		}

		const beforeM = modelKeySet(before);
		const afterM = modelKeySet(after);
		for (const m of after.models) {
			const key = modelKey(m);
			const old = before.models.find(
				(candidate) => modelKey(candidate) === key,
			);
			if (!beforeM.has(key)) changes.push(`Model added: ${key}`);
			if (old) {
				if (old.name !== m.name)
					changes.push(`Model ${key} name: ${old.name} → ${m.name}`);
				if (old.maxTokens !== m.maxTokens)
					changes.push(
						`Model ${key} maxTokens: ${old.maxTokens ?? "default"} → ${m.maxTokens ?? "default"}`,
					);
				if (old.contextWindow !== m.contextWindow)
					changes.push(
						`Model ${key} contextWindow: ${old.contextWindow ?? "default"} → ${m.contextWindow ?? "default"}`,
					);
			}
		}
		for (const m of before.models) {
			const key = modelKey(m);
			if (!afterM.has(key)) changes.push(`Model removed: ${key}`);
		}

		for (const role of after.roles) {
			const old = before.roles.find(
				(candidate) => candidate.role === role.role,
			);
			const next = `${role.provider}/${role.modelId}`;
			const prev = old ? `${old.provider}/${old.modelId}` : undefined;
			if (!old || prev !== next)
				changes.push(`Role ${role.role}: ${prev ?? "unset"} → ${next}`);
		}

		return changes;
	}

	#applyChange(id: string, newValue: string): void {
		if (id === "theme") {
			this.#state.theme = newValue;
			this.#state.dirty = true;
			return;
		}

		// Model toggle in models list
		if (id.startsWith("model:") && !id.includes("model-detail:")) {
			const key = id.slice("model:".length);
			const isDisabled = this.#state.disabledModels.includes(key);
			if (newValue === "disabled" && !isDisabled) {
				this.#state.disabledModels.push(key);
			} else if (newValue === "enabled" && isDisabled) {
				this.#state.disabledModels = this.#state.disabledModels.filter(
					(d) => d !== key,
				);
			}
			this.#state.dirty = true;
			return;
		}

		// Model detail view changes
		if (id.startsWith("model-detail:")) {
			const parts = id.split(":");
			if (parts.length >= 3) {
				const field = parts[1];
				const modelKeyStr = parts.slice(2).join(":");
				const model = this.#state.models.find(
					(m) => modelKey(m) === modelKeyStr,
				);
				if (!model) return;
				if (field === "id") {
					const nextId = newValue.trim();
					const duplicate = this.#state.models.some(
						(m) =>
							m.provider === model.provider &&
							m.id === nextId &&
							modelKey(m) !== modelKeyStr,
					);
					if (nextId.length === 0 || duplicate) {
						this.#statusMessage = duplicate
							? "Model ID already exists for this provider"
							: "Model ID cannot be blank";
						return;
					}
					const previousId = model.id;
					model.id = nextId;
					const nextKey = modelKey(model);
					this.#state.disabledModels = this.#state.disabledModels.map(
						(disabled) => (disabled === modelKeyStr ? nextKey : disabled),
					);
					for (const role of this.#state.roles) {
						if (role.provider === model.provider && role.modelId === previousId)
							role.modelId = nextId;
					}
					this.#editingModelKey = nextKey;
					this.#state.dirty = true;
				}
				if (field === "name" && newValue.trim().length > 0) {
					model.name = newValue.trim();
					this.#state.dirty = true;
				}
				if (field === "maxTokens") {
					model.maxTokens = Number.parseInt(newValue, 10);
					this.#state.dirty = true;
				}
				if (field === "contextWindow") {
					model.contextWindow = Number.parseInt(newValue, 10);
					this.#state.dirty = true;
				}
				if (field === "enabled") {
					if (
						newValue === "disabled" &&
						!this.#state.disabledModels.includes(modelKeyStr)
					) {
						this.#state.disabledModels.push(modelKeyStr);
					} else if (
						newValue === "enabled" &&
						this.#state.disabledModels.includes(modelKeyStr)
					) {
						this.#state.disabledModels = this.#state.disabledModels.filter(
							(d) => d !== modelKeyStr,
						);
					}
					this.#state.dirty = true;
				}
			}
			return;
		}

		// Role routing changes
		if (id.startsWith("role:")) {
			const roleName = id.slice("role:".length);
			const [provider, modelId] = newValue.split("/");
			if (!provider || !modelId) return;
			const existing = this.#state.roles.find(
				(candidate) => candidate.role === roleName,
			);
			if (existing) {
				existing.provider = provider;
				existing.modelId = modelId;
			} else {
				this.#state.roles.push({ role: roleName, provider, modelId });
			}
			this.#state.dirty = true;
			return;
		}

		// Provider detail view changes
		if (id.startsWith("provider-detail:")) {
			const parts = id.split(":");
			if (parts.length >= 3) {
				const field = parts[1];
				const providerKey = parts.slice(2).join(":");
				const provider = this.#state.providers.find(
					(p) => p.id === providerKey,
				);
				if (!provider) return;
				if (field === "id") {
					const nextId = newValue.trim();
					if (
						nextId.length === 0 ||
						(providerKey !== nextId && providerKeySet(this.#state).has(nextId))
					) {
						this.#statusMessage = "Provider ID already exists or is blank";
						return;
					}
					const previousId = provider.id;
					provider.id = nextId;
					provider.name = nextId;
					for (const model of this.#state.models) {
						if (model.provider === previousId) model.provider = nextId;
					}
					for (const role of this.#state.roles) {
						if (role.provider === previousId) role.provider = nextId;
					}
					this.#editingProviderKey = nextId;
					this.#state.dirty = true;
				}
				if (field === "apiFormat") {
					provider.apiFormat = newValue;
					this.#state.dirty = true;
				}
				if (field === "baseUrl") {
					provider.baseUrl = newValue.length > 0 ? newValue : undefined;
					this.#state.dirty = true;
				}
				if (field === "apiKey" && newValue.length > 0) {
					provider.apiKeyOverride = newValue;
					provider.apiKeyConfigured = true;
					provider.connectionState = "configured";
					this.#state.dirty = true;
				}
			}
			return;
		}
	}

	#buildItems(tabId: DashboardTabId): SettingItem[] {
		if (this.#savePreviewOpen) return this.#savePreviewItems();
		switch (tabId) {
			case "theme":
				return this.#buildThemeItems();
			case "providers":
				return this.#editingProviderKey
					? this.#buildProviderDetailItems(this.#editingProviderKey)
					: this.#buildProviderItems();
			case "models":
				return this.#editingModelKey
					? this.#buildModelDetailItems(this.#editingModelKey)
					: this.#buildModelListItems();
			case "system":
				return this.#buildSystemItems();
			default:
				return [];
		}
	}

	#buildThemeItems(): SettingItem[] {
		return [
			{
				id: "theme",
				label: "Theme",
				currentValue: this.#state.theme,
				values: THEME_NAMES,
			},
		];
	}

	#buildProviderItems(): SettingItem[] {
		const items: SettingItem[] = [
			{
				id: PROV_HEADING,
				label: "Providers (e to edit)",
				currentValue: "",
				heading: true,
			},
		];
		if (this.#state.providers.length === 0) {
			items.push({
				id: "no-providers",
				label: "  No providers configured",
				currentValue: "",
				heading: true,
			});
		} else {
			for (const provider of this.#state.providers) {
				const key = provider.apiKeyConfigured ? "configured" : "no key";
				items.push({
					id: `provider:${provider.id}`,
					label: `  ${provider.id}`,
					currentValue: `${provider.apiFormat} · ${provider.modelCount} models · key: ${key}`,
					changed: false,
				});
			}
		}

		items.push({
			id: ROLES_HEADING,
			label: "Assigned Roles",
			currentValue: "",
			heading: true,
		});
		if (this.#state.roles.length === 0) {
			items.push({
				id: "no-roles",
				label: "  No role assignments",
				currentValue: "",
				heading: true,
			});
		} else {
			for (const role of this.#state.roles) {
				items.push({
					id: `role:${role.role}`,
					label: `  ${role.role}`,
					currentValue: `${role.provider}/${role.modelId}`,
					values: this.#modelRouteValues(),
				});
			}
		}
		return items;
	}

	#buildProviderDetailItems(providerKey: string): SettingItem[] {
		const provider = this.#state.providers.find((p) => p.id === providerKey);
		if (!provider) {
			return [
				{
					id: "provider-not-found",
					label: "Provider not found",
					currentValue: "",
				},
			];
		}

		const items: SettingItem[] = [
			{
				id: "provider-detail:back",
				label: "← Back to providers",
				currentValue: "",
				heading: true,
			},
			{
				id: `provider-detail:name:${providerKey}`,
				label: `Provider: ${provider.name}`,
				currentValue: "",
				heading: true,
			},
			{
				id: `provider-detail:baseUrl:${providerKey}`,
				label: "  Base URL",
				currentValue: provider.baseUrl ?? "not set",
				changed: !provider.baseUrl,
				submenu: (currentValue, done) =>
					new TextInput(
						"Base URL",
						currentValue === "not set" ? "" : currentValue,
						done,
					),
			},
			{
				id: `provider-detail:apiFormat:${providerKey}`,
				label: "  API format",
				currentValue: provider.apiFormat,
				values: API_FORMATS,
			},
			{
				id: `provider-detail:apiKey:${providerKey}`,
				label: "  API key",
				currentValue: provider.apiKeyConfigured ? "●●●● configured" : "not set",
				description:
					"Press Enter, type a replacement key, Enter to apply. Blank leaves it unchanged.",
				submenu: (_currentValue, done) =>
					new TextInput("New API key", "", done),
			},
		];

		const providerModels = this.#state.models.filter(
			(m) => m.provider === providerKey,
		);
		items.push({
			id: `provider-detail:models-heading:${providerKey}`,
			label: `Models (${providerModels.length})`,
			currentValue: "",
			heading: true,
		});

		if (providerModels.length === 0) {
			items.push({
				id: `provider-detail:no-models:${providerKey}`,
				label: "  No models",
				currentValue: "",
			});
		} else {
			for (const model of providerModels) {
				const key = modelKey(model);
				const isDisabled = this.#state.disabledModels.includes(key);
				const status = isDisabled ? "disabled" : "enabled";
				const maxT = model.maxTokens ? ` · max ${model.maxTokens}` : "";
				items.push({
					id: `provider-model:${key}`,
					label: `  ${model.name}`,
					currentValue: `${model.id}${maxT} · ${status}  (x to delete)`,
				});
			}
		}

		items.push({
			id: `provider-detail:add-heading:${providerKey}`,
			label: "Actions",
			currentValue: "",
			heading: true,
		});
		items.push({
			id: `provider-detail:add:${providerKey}`,
			label: "  [a] Add model",
			currentValue: "press a",
			heading: true,
		});
		items.push({
			id: `provider-detail:fetch:${providerKey}`,
			label: "  [f] Fetch models from endpoint",
			currentValue: "press f",
			heading: true,
		});

		if (this.#statusMessage) {
			items.push({
				id: FETCH_STATUS_ITEM,
				label: `  ${this.#statusMessage}`,
				currentValue: "",
			});
		}

		return items;
	}

	#buildModelListItems(): SettingItem[] {
		const items: SettingItem[] = [];
		if (this.#state.models.length === 0) {
			items.push({
				id: "no-models",
				label: "No models available",
				currentValue: "",
			});
		} else {
			for (const model of this.#state.models) {
				const key = modelKey(model);
				const isDisabled = this.#state.disabledModels.includes(key);
				const status = isDisabled ? "disabled" : "enabled";
				const caps =
					model.capabilities.length > 0
						? ` · ${model.capabilities.join(", ")}`
						: "";
				const roles =
					model.roles.length > 0 ? ` · [${model.roles.join(", ")}]` : "";
				items.push({
					id: `model:${key}`,
					label: `  ${model.provider}/${model.name}${roles}${caps}`,
					currentValue: status,
					values: ["enabled", "disabled"],
				});
			}
		}
		return items;
	}

	#buildModelDetailItems(key: string): SettingItem[] {
		const model = this.#state.models.find((m) => modelKey(m) === key);
		if (!model) {
			return [
				{ id: "model-not-found", label: "Model not found", currentValue: "" },
			];
		}

		const isDisabled = this.#state.disabledModels.includes(key);
		const status = isDisabled ? "disabled" : "enabled";

		return [
			{
				id: "detail-back",
				label: "← Back to models",
				currentValue: "",
				heading: true,
			},
			{
				id: `model-detail:id:${key}`,
				label: "  Model ID",
				currentValue: model.id,
				submenu: (currentValue, done) =>
					new TextInput("Model ID", currentValue, done),
			},
			{
				id: `model-detail:name:${key}`,
				label: "  Name",
				currentValue: model.name,
				submenu: (currentValue, done) =>
					new TextInput("Model name", currentValue, done),
			},
			{
				id: `model-detail:provider:${key}`,
				label: "  Provider",
				currentValue: model.provider,
			},
			{
				id: `model-detail:enabled:${key}`,
				label: "  Enabled",
				currentValue: status,
				values: ["enabled", "disabled"],
			},
			{
				id: `model-detail:contextWindow:${key}`,
				label: "  Context window",
				currentValue: model.contextWindow
					? String(model.contextWindow)
					: "default",
				values: CONTEXT_WINDOW_VALUES,
			},
			{
				id: `model-detail:maxTokens:${key}`,
				label: "  Max tokens",
				currentValue: model.maxTokens ? String(model.maxTokens) : "default",
				values: MAX_TOKENS_VALUES,
			},
		];
	}

	#modelRouteValues(): string[] {
		return this.#state.models
			.filter((model) => !this.#state.disabledModels.includes(modelKey(model)))
			.map((model) => `${model.provider}/${model.id}`);
	}

	#buildSystemItems(): SettingItem[] {
		return [
			{
				id: "agent-dir",
				label: "Agent directory",
				currentValue: shortenPath(this.#state.agentDir),
			},
			{
				id: "config-path",
				label: "Config path",
				currentValue: shortenPath(this.#state.configPath),
			},
			{
				id: "version",
				label: "omp version",
				currentValue: this.#state.version,
			},
			{
				id: "provider-count",
				label: "Providers",
				currentValue: String(this.#state.providers.length),
			},
			{
				id: "model-count",
				label: "Models",
				currentValue: String(this.#state.models.length),
			},
		];
	}

	#footerHint(): string {
		if (this.#saveError) return `Save error: ${this.#saveError}`;
		if (this.#savePreviewOpen) return "Ctrl+S to confirm save · Esc to cancel";
		if (this.#editingProviderKey)
			return "Enter to edit · 'a' add model · 'x' delete model · 'f' fetch · Esc back";
		if (this.#editingModelKey) return "Enter to edit · Esc back";
		if (this.#currentTabId === "providers")
			return "'n' new provider · 'e' edit provider · Tab switch · Ctrl+S save · Esc quit";
		if (this.#currentTabId === "models")
			return "'e' edit model · Enter toggle · Tab switch · Ctrl+S save · Esc quit";
		if (this.#state.dirty) return "Ctrl+S save · Esc quit";
		return "Esc quit";
	}

	render(width: number): readonly string[] {
		const height = Math.max(14, process.stdout.rows || 40);
		const innerWidth = Math.max(1, width - 4);

		const tabLines = this.#tabBar.render(innerWidth);
		const list = this.#settingsList;
		if (list) {
			list.setMaxVisible(Math.max(7, height - tabLines.length - 6));
		}
		const contentLines = list ? list.render(innerWidth) : [];

		const out: string[] = [];
		out.push(topBorder(width, "Configuration"));
		for (const line of tabLines) {
			out.push(row(line, width));
		}
		out.push(divider(width));
		const contentRows = Math.max(7, height - tabLines.length - 6);
		for (let i = 0; i < contentRows; i++) {
			out.push(row(contentLines[i] ?? "", width));
		}
		out.push(divider(width));
		const hint = this.#footerHint();
		out.push(row(hint, width));
		out.push(bottomBorder(width));
		return out;
	}
}
