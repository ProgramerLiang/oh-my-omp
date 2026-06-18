import type { ConfigChange, ConfigState } from "../types";

export function diffConfigStates(
	before: ConfigState,
	after: ConfigState,
): ConfigChange[] {
	const changes: ConfigChange[] = [];
	if (before.theme !== after.theme) {
		changes.push({ path: "theme", before: before.theme, after: after.theme });
	}
	const beforeStr = JSON.stringify([...before.disabledModels].sort());
	const afterStr = JSON.stringify([...after.disabledModels].sort());
	if (beforeStr !== afterStr) {
		changes.push({
			path: "disabledModels",
			before: before.disabledModels,
			after: after.disabledModels,
		});
	}
	return changes;
}

function formatValue(value: unknown): string {
	if (typeof value === "string") return value;
	const encoded = JSON.stringify(value);
	return encoded ?? String(value);
}

export function formatConfigChange(change: ConfigChange): string {
	return `${change.path}: ${formatValue(change.before)} → ${formatValue(change.after)}`;
}
