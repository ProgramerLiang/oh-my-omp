import { formatDisplayLines } from "../utils/format";

export function renderThemePreview(
	theme: string,
	selected: boolean,
	width: number,
): readonly string[] {
	return formatDisplayLines(
		[
			`${theme} — ${selected ? "selected" : "available"}`,
			"  sample: prompt tool result diff",
		],
		width,
	);
}
