import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { AgentContext } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";

const mockMoveTimelineElements = mock(
	(_args: { elementIds: string[]; start: number; targetTrackId?: string }) => ({
		success: true,
		movedElements: [{ elementId: "clip-1", trackId: "main", start: 4, end: 8 }],
	}),
);

mock.module("@/agent/context", () => ({
	EditorContextAdapter: {
		moveTimelineElements: mockMoveTimelineElements,
	},
}));

await import("@/agent/tools/move-timeline-elements.tool");

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
			trackId: "main",
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
			],
		},
		{
			trackId: "overlay-1",
			trackRef: "overlay-1",
			trackLabel: "Overlay",
			type: "overlay",
			position: 1,
			visualLayer: 1,
			isVisualLayer: true,
			stacking: "above_main",
			elements: [],
		},
	],
};

describe("move_timeline_elements tool", () => {
	beforeEach(() => {
		mockMoveTimelineElements.mockClear();
	});

	test("is registered in the tool registry", () => {
		expect(toolRegistry.has("move_timeline_elements")).toBe(true);
	});

	test("moves timeline elements through the editor adapter", async () => {
		const tool = toolRegistry.get("move_timeline_elements");
		const result = await tool.execute(
			{ elementIds: ["clip-1"], start: 4, targetTrackId: "overlay-1" },
			context,
		);

		expect(mockMoveTimelineElements).toHaveBeenCalledWith({
			elementIds: ["clip-1"],
			start: 4,
			targetTrackId: "overlay-1",
		});
		expect(result).toEqual({
			success: true,
			movedElements: [
				{ elementId: "clip-1", trackId: "main", start: 4, end: 8 },
			],
		});
	});

	test("omits targetTrackId when moving within current tracks", async () => {
		const tool = toolRegistry.get("move_timeline_elements");
		await tool.execute({ elementIds: ["clip-1"], start: 4 }, context);

		expect(mockMoveTimelineElements).toHaveBeenCalledWith({
			elementIds: ["clip-1"],
			start: 4,
		});
	});

	test("validates move arguments", async () => {
		const tool = toolRegistry.get("move_timeline_elements");

		expect(await tool.execute({ elementIds: [], start: 0 }, context)).toEqual({
			error:
				"targets must be a non-empty array of element refs, displayNames, or elementIds.",
		});
		expect(
			await tool.execute({ elementIds: ["clip-1"], start: -1 }, context),
		).toEqual({
			error: "Invalid start time",
		});
		expect(
			await tool.execute(
				{ elementIds: ["clip-1"], start: Number.NaN },
				context,
			),
		).toEqual({
			error: "Invalid start time",
		});
		expect(
			await tool.execute(
				{ elementIds: ["clip-1"], start: 0, targetTrackId: "" },
				context,
			),
		).toEqual({
			error: 'Track not found: "". Available: main-1, overlay-1',
		});
		expect(mockMoveTimelineElements).not.toHaveBeenCalled();
	});
});
