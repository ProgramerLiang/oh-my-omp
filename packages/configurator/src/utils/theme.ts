import type { SettingsListTheme, TabBarTheme } from "@oh-my-pi/pi-tui";
import chalk from "chalk";

export function getTabBarTheme(): TabBarTheme {
	return {
		label: (text: string) => chalk.bold.cyan(text),
		activeTab: (text: string) => chalk.bold.inverse.white(text),
		inactiveTab: (text: string) => chalk.gray(text),
		mutedTab: (text: string) => chalk.dim(text),
		hoverTab: (text: string) => chalk.bgWhite.dim(text),
		hint: (text: string) => chalk.dim(text),
	};
}

export function getSettingsListTheme(): SettingsListTheme {
	return {
		label: (text: string, selected: boolean) =>
			selected ? chalk.bold(text) : text,
		value: (text: string, selected: boolean) =>
			selected ? chalk.cyan(text) : chalk.gray(text),
		description: (text: string) => chalk.dim(text),
		cursor: chalk.cyan("▌"),
		hint: (text: string) => chalk.dim(text),
	};
}

export function topBorder(width: number, title: string): string {
	const rule = title
		? `${chalk.cyan("┌─")} ${title} ${chalk.cyan("─".repeat(Math.max(0, width - title.length - 5)))}`
		: chalk.cyan("─".repeat(width));
	return rule;
}

export function row(content: string, width: number): string {
	return `${chalk.cyan("│")} ${content}${" ".repeat(Math.max(0, width - content.length - 3))}${chalk.cyan("│")}`;
}

export function divider(width: number): string {
	return chalk.cyan(`├${"─".repeat(Math.max(0, width - 2))}┤`);
}

export function bottomBorder(width: number): string {
	return chalk.cyan(`└${"─".repeat(Math.max(0, width - 2))}┘`);
}
