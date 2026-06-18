import type { ConfigState } from "../../types";
import { formatDisplayLines } from "../../utils/format";

export function renderExtensionsTab(
	state: ConfigState,
	width: number,
): readonly string[] {
	const lines: string[] = ["Extensions", ""];
	if (state.extensions.length === 0)
		return formatDisplayLines(
			[...lines, "No extension overrides configured."],
			width,
		);
	for (const extension of state.extensions) {
		lines.push(
			`${extension.enabled ? "[x]" : "[ ]"} ${extension.name} — ${extension.description}`,
		);
	}
	return formatDisplayLines(lines, width);
}
