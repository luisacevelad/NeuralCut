import { describe, expect, test } from "bun:test";
import type { AgentContext } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";

await import("@/agent/tools/list-timeline.tool");

function makeContext(overrides: Partial<AgentContext> = {}): AgentContext {
	return {
		projectId: "proj-1",
		activeSceneId: "scene-A",
		mediaAssets: [],
		timelineTracks: [
			{
				trackId: "main-track",
				type: "main",
				position: 0,
				visualLayer: 0,
				isVisualLayer: true,
				stacking: "main",
				elements: [
					{
						elementId: "clip-1",
						type: "video",
						assetId: "m1",
						name: "Intro",
						start: 0,
						end: 10,
					},
				],
			},
		],
		playbackTimeMs: 0,
		...overrides,
	};
}

describe("list_timeline tool", () => {
	test("is registered in the tool registry", () => {
		expect(toolRegistry.has("list_timeline")).toBe(true);
	});

	test("returns active timeline tracks", async () => {
		const tool = toolRegistry.get("list_timeline");
		const result = await tool.execute({}, makeContext());

		expect(result).toEqual({
			tracks: [
				{
					trackId: "main-track",
					type: "main",
					position: 0,
					visualLayer: 0,
					isVisualLayer: true,
					stacking: "main",
					elements: [
						{
							elementId: "clip-1",
							type: "video",
							assetId: "m1",
							name: "Intro",
							start: 0,
							end: 10,
						},
					],
				},
			],
		});
	});

	test("returns no active timeline error without active scene", async () => {
		const tool = toolRegistry.get("list_timeline");
		const result = await tool.execute({}, makeContext({ activeSceneId: null }));

		expect(result).toEqual({ error: "No active timeline" });
	});

	test("returns no active timeline error without mapped tracks", async () => {
		const tool = toolRegistry.get("list_timeline");
		const result = await tool.execute(
			{},
			makeContext({ timelineTracks: undefined }),
		);

		expect(result).toEqual({ error: "No active timeline" });
	});
});
