import { renderProviderCard } from "../../components/provider-card";
import { renderRoleRouter } from "../../components/role-router";
import type { ConfigState } from "../../types";
import { formatDisplayLines } from "../../utils/format";

export function renderProvidersTab(
	state: ConfigState,
	width: number,
): readonly string[] {
	const lines: string[] = ["Providers", ""];
	if (state.providers.length > 0) {
		for (const provider of state.providers) {
			lines.push(...renderProviderCard(provider, width), "");
		}
	} else {
		lines.push(
			...formatDisplayLines(
				["No providers configured.", "Press n to add a provider."],
				width,
			),
		);
	}
	lines.push(
		"",
		...formatDisplayLines(["Role routing"], width),
		...renderRoleRouter(state.roles, width),
	);
	return formatDisplayLines(lines, width);
}
