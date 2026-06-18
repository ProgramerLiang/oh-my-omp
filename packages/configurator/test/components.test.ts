import { describe, expect, test } from "bun:test";
import { renderModelCell } from "../src/components/model-cell";
import { renderProviderCard } from "../src/components/provider-card";
import { renderRoleRouter } from "../src/components/role-router";
import { renderThemePreview } from "../src/components/theme-preview";
import { shortenPath } from "../src/utils/path";

describe("dashboard render helpers", () => {
	test("renders provider summary", () => {
		const text = renderProviderCard(
			{
				id: "anthropic",
				name: "Anthropic",
				connectionState: "connected",
				modelCount: 5,
				assignedRoles: ["default"],
				apiKeyConfigured: true,
				apiFormat: "anthropic-messages",
			},
			80,
		).join("\n");

		expect(text).toContain("Anthropic");
		expect(text).toContain("connected");
		expect(text).toContain("5 models");
	});

	test("renders role routing", () => {
		const text = renderRoleRouter(
			[{ role: "default", provider: "anthropic", modelId: "claude-4" }],
			80,
		).join("\n");

		expect(text).toContain("default → anthropic/claude-4");
	});

	test("renders model summary", () => {
		const text = renderModelCell(
			{
				id: "claude-4",
				name: "Claude 4",
				provider: "anthropic",
				available: true,
				roles: ["default"],
				capabilities: ["reasoning"],
			},
			80,
		).join("\n");

		expect(text).toContain("Claude 4");
		expect(text).toContain("reasoning");
	});

	test("renders selected theme preview", () => {
		expect(renderThemePreview("tokyo-night", true, 80).join("\n")).toContain(
			"selected",
		);
	});

	test("sanitizes control bytes and truncates wide text by display width", () => {
		const [line] = renderThemePreview(
			"\u001b[31m語\t語\n語\u0007語語",
			true,
			7,
		);

		expect(line).not.toContain("\u001b");
		expect(line).not.toContain("\t");
		expect(line).not.toContain("\n");
		expect(line).not.toContain("\u0007");
		expect(Bun.stringWidth(line)).toBeLessThanOrEqual(7);
		expect(line).toContain("…");
	});

	test("shortens home paths with slash or backslash separators", () => {
		expect(shortenPath("/home/me/.omp/config.yml", "/home/me")).toBe(
			"~/.omp/config.yml",
		);
		expect(
			shortenPath("C:\\Users\\me\\.omp\\config.yml", "C:\\Users\\me"),
		).toBe("~/.omp/config.yml");
	});
});
