import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { AgentContext } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";

const mockSplitTimeline = mock(
	(_args: { times: number[]; elementId?: string }) => ({
		success: true,
		affectedElements: ["clip-1", "clip-2"],
	}),
);

mock.module("@/agent/context", () => ({
	EditorContextAdapter: {
		splitTimeline: mockSplitTimeline,
	},
}));

await import("@/agent/tools/split.tool");

const context: AgentContext = {
	projectId: "proj-1",
	activeSceneId: "scene-A",
	fps: null,
	duration: null,
	resolution: null,
	aspectRatio: null,
	projectName: null,
	mediaAssets: [],
	playbackTimeMs: 0,
	timelineTracks: [
		{
			trackId: "track-1",
			trackRef: "main-1",
			trackLabel: "Main",
			type: "main",
			position: 0,
			elements: [
				{
					elementId: "el-1",
					ref: "clip-1",
					assetName: "intro.mov",
					type: "video",
					startTime: 0,
					duration: 10,
				},
			],
		},
	],
};

describe("split tool", () => {
	beforeEach(() => {
		mockSplitTimeline.mockClear();
	});

	test("is registered in the tool registry", () => {
		expect(toolRegistry.has("split")).toBe(true);
	});

	test("splits the timeline through the editor adapter", async () => {
		const tool = toolRegistry.get("split");
		const result = await tool.execute({ times: [2] }, context);

		expect(mockSplitTimeline).toHaveBeenCalledWith({
			times: [2],
			elementId: undefined,
		});
		expect(result).toEqual({
			success: true,
			affectedElements: ["clip-1", "clip-2"],
		});
	});

	test("supports multiple split times", async () => {
		const tool = toolRegistry.get("split");
		await tool.execute({ times: [2, 5, 8] }, context);

		expect(mockSplitTimeline).toHaveBeenCalledWith({
			times: [2, 5, 8],
			elementId: undefined,
		});
	});

	test("resolves target ref to elementId", async () => {
		const tool = toolRegistry.get("split");
		await tool.execute({ times: [2], target: "clip-1" }, context);

		expect(mockSplitTimeline).toHaveBeenCalledWith({
			times: [2],
			elementId: "el-1",
		});
	});

	test("resolves target by raw element id", async () => {
		const tool = toolRegistry.get("split");
		await tool.execute({ times: [2], target: "el-1" }, context);

		expect(mockSplitTimeline).toHaveBeenCalledWith({
			times: [2],
			elementId: "el-1",
		});
	});

	test("returns error for unresolved target", async () => {
		const tool = toolRegistry.get("split");
		const result = await tool.execute(
			{ times: [2], target: "nonexistent" },
			context,
		);

		expect(result).toEqual({
			error: expect.stringContaining("not found"),
		});
		expect(mockSplitTimeline).not.toHaveBeenCalled();
	});

	test("validates split times", async () => {
		const tool = toolRegistry.get("split");

		expect(await tool.execute({ times: [] }, context)).toEqual({
			error: "Invalid split times",
		});
		expect(await tool.execute({ times: [2, Number.NaN] }, context)).toEqual({
			error: "Invalid split times",
		});
		expect(await tool.execute({ times: [-1] }, context)).toEqual({
			error: "Invalid split times",
		});
		expect(await tool.execute({ times: "2" }, context)).toEqual({
			error: "Invalid split times",
		});
		expect(mockSplitTimeline).not.toHaveBeenCalled();
	});
});
