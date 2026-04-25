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
	mediaAssets: [],
	playbackTimeMs: 0,
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
				'elementIds must be a non-empty JSON array of strings, e.g. ["id1","id2"]',
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
			error: "Invalid target track id",
		});
		expect(mockMoveTimelineElements).not.toHaveBeenCalled();
	});
});
