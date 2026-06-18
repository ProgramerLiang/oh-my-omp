import { renderThemePreview } from "../../components/theme-preview";
import type { ConfigState } from "../../types";
import { formatDisplayLines } from "../../utils/format";

const THEMES = [
	"default",
	"catppuccin-mocha",
	"tokyo-night",
	"nord",
	"gruvbox-dark",
] as const;

export function renderThemeTab(
	state: ConfigState,
	width: number,
): readonly string[] {
	const lines: string[] = ["Theme", ""];
	for (const theme of THEMES) {
		lines.push(...renderThemePreview(theme, theme === state.theme, width), "");
	}
	return formatDisplayLines(lines, width);
}
