import type { ModelSummary } from "../types";
import { formatDisplayLines } from "../utils/format";

export function renderModelCell(
	model: ModelSummary,
	width: number,
): readonly string[] {
	const roles = model.roles.length > 0 ? model.roles.join(", ") : "no roles";
	const capabilities =
		model.capabilities.length > 0
			? model.capabilities.join(", ")
			: "no capabilities";
	const availability = model.available ? "available" : "unavailable";
	const lines = [
		`${model.name} (${model.id}) — ${model.provider} — ${availability}`,
		`  roles: ${roles} | capabilities: ${capabilities}`,
	];
	return formatDisplayLines(lines, width);
}
