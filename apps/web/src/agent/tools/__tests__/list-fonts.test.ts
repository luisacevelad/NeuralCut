import { describe, expect, test } from "bun:test";
import { toolRegistry } from "@/agent/tools/registry";
import type { AgentContext } from "@/agent/types";

// Must import to register the tool
import "@/agent/tools/list-fonts.tool";

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

describe("list_fonts tool", () => {
	test("is registered in the tool registry", () => {
		expect(toolRegistry.has("list_fonts")).toBe(true);
	});

	test("returns up to 10 fonts by default (no query, no limit)", async () => {
		const tool = toolRegistry.get("list_fonts");
		const result = await tool.execute({}, stubContext);

		expect(result.fonts).toBeInstanceOf(Array);
		expect(result.fonts.length).toBe(10);
		for (const font of result.fonts) {
			expect(font).toHaveProperty("name");
			expect(typeof font.name).toBe("string");
		}
	});

	test("filters fonts by partial case-insensitive query", async () => {
		const tool = toolRegistry.get("list_fonts");
		const result = await tool.execute({ query: "rob" }, stubContext);

		expect(result.fonts.length).toBeGreaterThan(0);
		for (const font of result.fonts) {
			expect(font.name.toLowerCase()).toContain("rob");
		}
	});

	test("respects explicit limit", async () => {
		const tool = toolRegistry.get("list_fonts");
		const result = await tool.execute({ limit: 3 }, stubContext);

		expect(result.fonts).toHaveLength(3);
	});

	test("returns empty array for non-matching query", async () => {
		const tool = toolRegistry.get("list_fonts");
		const result = await tool.execute(
			{ query: "zzzznonexistentfont" },
			stubContext,
		);

		expect(result.fonts).toHaveLength(0);
	});

	test("query + limit work together", async () => {
		const tool = toolRegistry.get("list_fonts");
		const result = await tool.execute({ query: "a", limit: 5 }, stubContext);

		expect(result.fonts.length).toBeLessThanOrEqual(5);
		for (const font of result.fonts) {
			expect(font.name.toLowerCase()).toContain("a");
		}
	});

	test("ignores invalid limit and uses default", async () => {
		const tool = toolRegistry.get("list_fonts");
		const result = await tool.execute({ limit: -1 }, stubContext);

		expect(result.fonts).toHaveLength(10);
	});

	test("ignores non-number limit", async () => {
		const tool = toolRegistry.get("list_fonts");
		const result = await tool.execute({ limit: "five" }, stubContext);

		expect(result.fonts).toHaveLength(10);
	});
});
