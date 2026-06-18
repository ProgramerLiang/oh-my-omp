#!/usr/bin/env bun

import { ProcessTerminal, TUI } from "@oh-my-pi/pi-tui";
import {
	createDashboard,
	readConfigState,
	resolveAgentDir,
	resolveConfiguratorVersion,
	writeConfigStateFull,
} from "./index";

const HELP = "omp-config\n\nUsage: omp-config [--help] [--version] [--json]\n";

export async function main(
	argv: readonly string[] = Bun.argv.slice(2),
): Promise<void> {
	if (argv.includes("--help") || argv.includes("-h")) {
		process.stdout.write(HELP);
		return;
	}
	if (argv.includes("--version") || argv.includes("-v")) {
		process.stdout.write(`${resolveConfiguratorVersion()}\n`);
		return;
	}

	const agentDir = resolveAgentDir();
	const version = resolveConfiguratorVersion();
	const state = await readConfigState({ agentDir, version });

	if (argv.includes("--json")) {
		process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
		return;
	}

	const tui = new TUI(new ProcessTerminal());
	const dashboard = createDashboard(state, {
		onSave: () => {
			const current = dashboard.state;
			if (!current.dirty) return;
			return writeConfigStateFull(current).then(() => {
				current.dirty = false;
			});
		},
		onQuit: () => tui.stop(),
	});
	tui.addChild(dashboard);
	tui.setFocus(dashboard);
	tui.start();
}

if (import.meta.main) {
	main().catch((error: unknown) => {
		process.stderr.write(
			`${error instanceof Error ? error.message : String(error)}\n`,
		);
		process.exitCode = 1;
	});
}
