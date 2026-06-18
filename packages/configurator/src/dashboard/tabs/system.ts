import type { ConfigState } from "../../types";
import { formatDisplayLines } from "../../utils/format";
import { shortenPath } from "../../utils/path";

export function renderSystemTab(
	state: ConfigState,
	width: number,
): readonly string[] {
	return formatDisplayLines(
		[
			"System",
			"",
			`Agent directory: ${shortenPath(state.agentDir)}`,
			`Config path: ${shortenPath(state.configPath)}`,
			`Version: ${state.version}`,
			`Providers: ${state.providers.length}`,
			`Models: ${state.models.length}`,
			`MCP servers: ${state.mcpServers.length}`,
		],
		width,
	);
}
