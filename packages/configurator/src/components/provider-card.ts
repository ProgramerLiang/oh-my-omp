import type { ProviderSummary } from "../types";
import { formatDisplayLines } from "../utils/format";

export function renderProviderCard(
	provider: ProviderSummary,
	width: number,
): readonly string[] {
	const roles =
		provider.assignedRoles.length > 0
			? provider.assignedRoles.join(", ")
			: "no roles";
	const apiKeyState = provider.apiKeyConfigured ? "configured" : "missing";
	const lines = [
		`${provider.name} (${provider.id}) — ${provider.connectionState}`,
		`  ${provider.modelCount} models | roles: ${roles} | API key: ${apiKeyState}`,
	];
	return formatDisplayLines(lines, width);
}
