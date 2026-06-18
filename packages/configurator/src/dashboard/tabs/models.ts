import { renderModelCell } from "../../components/model-cell";
import type { ConfigState } from "../../types";
import { formatDisplayLines } from "../../utils/format";

export function renderModelsTab(
	state: ConfigState,
	width: number,
): readonly string[] {
	const lines: string[] = ["Models", ""];
	if (state.models.length === 0)
		return formatDisplayLines([...lines, "No models discovered."], width);
	for (const model of state.models) {
		lines.push(...renderModelCell(model, width), "");
	}
	return formatDisplayLines(lines, width);
}
