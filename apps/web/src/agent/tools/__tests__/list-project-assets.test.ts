import { describe, expect, test } from "bun:test";
import type { AgentContext } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";

await import("@/agent/tools/list-project-assets.tool");

function makeContext(overrides: Partial<AgentContext> = {}): AgentContext {
	return {
		projectId: "proj-1",
		activeSceneId: "scene-A",
		mediaAssets: [
			{
				id: "v1",
				name: "clip.mp4",
				type: "video",
				duration: 30,
				usedInTimeline: true,
			},
			{
				id: "a1",
				name: "music.mp3",
				type: "audio",
				duration: 120,
				usedInTimeline: false,
			},
			{
				id: "i1",
				name: "logo.png",
				type: "image",
				duration: 0,
				usedInTimeline: false,
			},
		],
		playbackTimeMs: 0,
		...overrides,
	};
}

describe("list_project_assets tool", () => {
	test("is registered in the tool registry", () => {
		expect(toolRegistry.has("list_project_assets")).toBe(true);
	});

	test("returns all project assets by default", async () => {
		const tool = toolRegistry.get("list_project_assets");
		const result = await tool.execute({}, makeContext());

		expect(result).toEqual({
			assets: [
				{
					id: "v1",
					name: "clip.mp4",
					type: "video",
					duration: 30,
					usedInTimeline: true,
				},
				{
					id: "a1",
					name: "music.mp3",
					type: "audio",
					duration: 120,
					usedInTimeline: false,
				},
				{
					id: "i1",
					name: "logo.png",
					type: "image",
					usedInTimeline: false,
				},
			],
		});
	});

	test("filters by usage and type", async () => {
		const tool = toolRegistry.get("list_project_assets");

		const used = await tool.execute({ filter: "used" }, makeContext());
		const unusedAudio = await tool.execute(
			{ filter: "unused", type: "audio" },
			makeContext(),
		);

		expect(used).toEqual({
			assets: [
				{
					id: "v1",
					name: "clip.mp4",
					type: "video",
					duration: 30,
					usedInTimeline: true,
				},
			],
		});
		expect(unusedAudio).toEqual({
			assets: [
				{
					id: "a1",
					name: "music.mp3",
					type: "audio",
					duration: 120,
					usedInTimeline: false,
				},
			],
		});
	});

	test("returns no active project error", async () => {
		const tool = toolRegistry.get("list_project_assets");
		const result = await tool.execute({}, makeContext({ projectId: null }));

		expect(result).toEqual({ error: "No active project" });
	});

	test("validates filters", async () => {
		const tool = toolRegistry.get("list_project_assets");

		expect(await tool.execute({ filter: "bad" }, makeContext())).toEqual({
			error: "Invalid asset usage filter",
		});
		expect(await tool.execute({ type: "document" }, makeContext())).toEqual({
			error: "Invalid asset type filter",
		});
	});
});
