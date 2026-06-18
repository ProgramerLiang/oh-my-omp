import * as os from "node:os";
import * as path from "node:path";

export interface ResolveAgentDirOptions {
	override?: string;
	env?: Record<string, string | undefined>;
}

export function resolveAgentDir(options: ResolveAgentDirOptions = {}): string {
	if (options.override) return options.override;
	const env = options.env ?? Bun.env;
	const fromEnv = env.OMP_CONFIG_DIR;
	if (fromEnv) return fromEnv;
	return path.join(os.homedir(), ".omp", "agent");
}

export function resolveConfiguratorVersion(): string {
	return "15.13.3";
}
