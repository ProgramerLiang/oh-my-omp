function isControlByte(codePoint: number): boolean {
	return (
		codePoint <= 0x08 ||
		codePoint === 0x0b ||
		codePoint === 0x0c ||
		(codePoint >= 0x0e && codePoint <= 0x1f) ||
		codePoint === 0x7f ||
		(codePoint >= 0x80 && codePoint <= 0x9f)
	);
}

function stripControlBytes(value: string): string {
	let output = "";
	for (const char of value) {
		const codePoint = char.codePointAt(0);
		if (codePoint !== undefined && !isControlByte(codePoint)) output += char;
	}
	return output;
}

export function normalizeDisplayWidth(width: number): number {
	if (!Number.isFinite(width)) return 0;
	return Math.max(0, Math.floor(width));
}

export function sanitizeDisplayText(value: string): string {
	return stripControlBytes(
		Bun.stripANSI(value)
			.replaceAll("\t", "   ")
			.replace(/[\r\n]+/g, " "),
	);
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
