import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { AgentContext } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";

const mockDeleteTimelineElements = mock((_args: { elementIds: string[] }) => ({
	success: true,
	deletedElements: ["clip-1", "text-1"],
}));

mock.module("@/agent/context", () => ({
	EditorContextAdapter: {
		deleteTimelineElements: mockDeleteTimelineElements,
	},
}));

await import("@/agent/tools/delete-timeline-elements.tool");

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
			trackId: "main-track",
			trackRef: "main-1",
			trackLabel: "Main",
			type: "main",
			position: 0,
			visualLayer: 0,
			isVisualLayer: true,
			stacking: "main",
			elements: [
				{
					elementId: "clip-1",
					ref: "clip-1",
					displayName: "clip-1",
					type: "video",
					start: 0,
					end: 10,
					duration: 10,
				},
				{
					elementId: "text-1",
					ref: "text-1",
					displayName: "text-1",
					type: "text",
					start: 0,
					end: 5,
					duration: 5,
				},
				{
					elementId: "clip-2",
					ref: "clip-2",
					displayName: "clip-2",
					type: "video",
					start: 10,
					end: 20,
					duration: 10,
				},
			],
		},
	],
};

describe("delete_timeline_elements tool", () => {
	beforeEach(() => {
		mockDeleteTimelineElements.mockClear();
	});

	test("is registered in the tool registry", () => {
		expect(toolRegistry.has("delete_timeline_elements")).toBe(true);
	});

	test("deletes timeline elements through the editor adapter", async () => {
		const tool = toolRegistry.get("delete_timeline_elements");
		const result = await tool.execute(
			{ elementIds: ["clip-1", "text-1"] },
			context,
		);

		expect(mockDeleteTimelineElements).toHaveBeenCalledWith({
			elementIds: ["clip-1", "text-1"],
		});
		expect(result).toEqual({
			success: true,
			deletedElements: ["clip-1", "text-1"],
		});
	});

	test("validates element ids", async () => {
		const tool = toolRegistry.get("delete_timeline_elements");

		expect(await tool.execute({ elementIds: [] }, context)).toEqual({
			error:
				"targets must be a non-empty array of element refs, displayNames, or elementIds.",
		});
		expect(await tool.execute({ elementIds: ["", "  "] }, context)).toEqual(
			{
				error:
					"targets must be a non-empty array of element refs, displayNames, or elementIds.",
			},
		);
		expect(await tool.execute({}, context)).toEqual({
			error:
				"targets must be a non-empty array of element refs, displayNames, or elementIds.",
		});
		expect(mockDeleteTimelineElements).not.toHaveBeenCalled();
	});

	test("accepts comma-separated string as elementIds", async () => {
		const tool = toolRegistry.get("delete_timeline_elements");

		await tool.execute({ elementIds: "clip-1,clip-2" }, context);
		expect(mockDeleteTimelineElements).toHaveBeenCalledWith({
			elementIds: ["clip-1", "clip-2"],
		});
	});
});
