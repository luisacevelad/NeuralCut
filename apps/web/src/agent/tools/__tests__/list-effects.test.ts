import { describe, expect, mock, test } from "bun:test";
import { toolRegistry } from "@/agent/tools/registry";
import type { AgentContext } from "@/agent/types";

// Mock the effects registry BEFORE importing the tool
mock.module("@/lib/effects", () => ({
	effectsRegistry: {
		getAll: () => [
			{ type: "blur", name: "Blur", keywords: ["gaussian", "soft", "smooth"] },
			{ type: "grayscale", name: "Grayscale", keywords: ["desaturate", "black and white", "mono"] },
			{ type: "glow", name: "Glow", keywords: ["light", "neon", "bloom"] },
			{ type: "sepia", name: "Sepia", keywords: ["vintage", "warm", "retro"] },
			{ type: "color_temperature", name: "Color Temperature", keywords: ["warm", "cool", "tint"] },
			{ type: "vignette", name: "Vignette", keywords: ["dark edges", "focus", "fade"] },
			{ type: "pixelate", name: "Pixelate", keywords: ["mosaic", "pixel", "retro"] },
			{ type: "glitch", name: "Glitch", keywords: ["distort", "error", "digital"] },
			{ type: "chromatic_aberration", name: "Chromatic Aberration", keywords: ["color fringe", "rgb split"] },
			{ type: "scanlines", name: "Scanlines", keywords: ["crt", "tv", "retro"] },
			{ type: "film_grain", name: "Film Grain", keywords: ["noise", "cinematic", "analog"] },
			{ type: "saturation", name: "Saturation", keywords: ["vivid", "color", "intensity"] },
		],
	},
}));

await import("@/agent/tools/list-effects.tool");

const stubContext: AgentContext = {
	projectId: null,
	activeSceneId: null,
	fps: null,
	duration: null,
	resolution: null,
	aspectRatio: null,
	projectName: null,
	mediaAssets: [],
	playbackTimeMs: 0,
};

describe("list_effects tool", () => {
	test("is registered in the tool registry", () => {
		expect(toolRegistry.has("list_effects")).toBe(true);
	});

	test("returns up to 10 effects by default (no query, no limit)", async () => {
		const tool = toolRegistry.get("list_effects");
		const result = await tool.execute({}, stubContext);

		expect(result.effects).toBeInstanceOf(Array);
		expect(result.effects).toHaveLength(10);
		for (const effect of result.effects) {
			expect(effect).toHaveProperty("id");
			expect(effect).toHaveProperty("name");
			expect(effect).toHaveProperty("description");
		}
	});

	test("filters effects by partial case-insensitive query on name", async () => {
		const tool = toolRegistry.get("list_effects");
		const result = await tool.execute({ query: "blur" }, stubContext);

		expect(result.effects.length).toBeGreaterThan(0);
		for (const effect of result.effects) {
			expect(effect.id).toBe("blur");
		}
	});

	test("filters effects by keyword match", async () => {
		const tool = toolRegistry.get("list_effects");
		const result = await tool.execute({ query: "retro" }, stubContext);

		expect(result.effects.length).toBeGreaterThan(0);
		for (const effect of result.effects) {
			const matchesName = effect.name.toLowerCase().includes("retro");
			const matchesDesc = effect.description.toLowerCase().includes("retro");
			expect(matchesName || matchesDesc).toBe(true);
		}
	});

	test("respects explicit limit", async () => {
		const tool = toolRegistry.get("list_effects");
		const result = await tool.execute({ limit: 3 }, stubContext);

		expect(result.effects).toHaveLength(3);
	});

	test("query + limit work together", async () => {
		const tool = toolRegistry.get("list_effects");
		const result = await tool.execute({ query: "color", limit: 5 }, stubContext);

		expect(result.effects.length).toBeLessThanOrEqual(5);
		for (const effect of result.effects) {
			const matchesName = effect.name.toLowerCase().includes("color");
			const matchesDesc = effect.description.toLowerCase().includes("color");
			expect(matchesName || matchesDesc).toBe(true);
		}
	});

	test("ignores invalid limit and uses default", async () => {
		const tool = toolRegistry.get("list_effects");
		const result = await tool.execute({ limit: -1 }, stubContext);

		expect(result.effects).toHaveLength(10);
	});

	test("returns empty array for non-matching query", async () => {
		const tool = toolRegistry.get("list_effects");
		const result = await tool.execute(
			{ query: "zzzznonexistent" },
			stubContext,
		);

		expect(result.effects).toHaveLength(0);
	});
});
