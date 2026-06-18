import type { ConfigState } from "../../types";
import { formatDisplayLines } from "../../utils/format";

export function renderMcpTab(
	state: ConfigState,
	width: number,
): readonly string[] {
	const lines: string[] = ["MCP", ""];
	if (state.mcpServers.length === 0) {
		return formatDisplayLines(
			[...lines, "No MCP servers configured.", "Press n to add a server."],
			width,
		);
	}
	for (const server of state.mcpServers) {
		lines.push(
			`${server.name} — ${server.command} ${server.args.join(" ")}`,
			`  environment variables: ${server.envCount}`,
		);
	}
	return formatDisplayLines(lines, width);
}
