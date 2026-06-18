import * as os from "node:os";

export function shortenPath(
	value: string,
	home: string = os.homedir(),
): string {
	if (!home) return value;
	if (value === home) return "~";
	if (!value.startsWith(home)) return value;
	const separator = value.at(home.length);
	if (separator !== "/" && separator !== "\\") return value;
	return `~/${value.slice(home.length + 1).replaceAll("\\", "/")}`;
}
