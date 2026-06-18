const CONTROL_BYTES = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\x80-\x9f]/gu;

export function normalizeDisplayWidth(width: number): number {
	if (!Number.isFinite(width)) return 0;
	return Math.max(0, Math.floor(width));
}

export function sanitizeDisplayText(value: string): string {
	return Bun.stripANSI(value)
		.replaceAll("\t", "   ")
		.replace(/[\r\n]+/g, " ")
		.replace(CONTROL_BYTES, "");
}

export function truncateToWidth(value: string, width: number): string {
	const safeWidth = normalizeDisplayWidth(width);
	if (safeWidth <= 0) return "";
	if (Bun.stringWidth(value) <= safeWidth) return value;

	let output = "";
	for (const char of value) {
		const next = `${output}${char}`;
		if (Bun.stringWidth(`${next}…`) > safeWidth) return `${output}…`;
		output = next;
	}
	return output;
}

export function formatDisplayText(value: string, width: number): string {
	return truncateToWidth(sanitizeDisplayText(value), width);
}

export function formatDisplayLines(
	lines: readonly string[],
	width: number,
): readonly string[] {
	return lines.map((line) => formatDisplayText(line, width));
}
