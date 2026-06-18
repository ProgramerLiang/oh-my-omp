export type DashboardTabId =
	| "providers"
	| "models"
	| "theme"
	| "extensions"
	| "mcp"
	| "system";
export type ProviderConnectionState =
	| "configured"
	| "connected"
	| "failed"
	| "missing";

export interface ProviderSummary {
	id: string;
	name: string;
	connectionState: ProviderConnectionState;
	baseUrl?: string;
	modelCount: number;
	assignedRoles: string[];
	apiKeyConfigured: boolean;
	apiFormat: string;
	apiKeyOverride?: string;
}

export interface ModelSummary {
	id: string;
	name: string;
	provider: string;
	available: boolean;
	roles: string[];
	capabilities: string[];
	maxTokens?: number;
	contextWindow?: number;
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
	disabledModels: string[];
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
