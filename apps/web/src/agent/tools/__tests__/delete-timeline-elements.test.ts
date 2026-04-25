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
	mediaAssets: [],
	playbackTimeMs: 0,
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
			error: "Invalid element ids",
		});
		expect(await tool.execute({ elementIds: ["clip-1", ""] }, context)).toEqual(
			{
				error: "Invalid element ids",
			},
		);
		expect(await tool.execute({ elementIds: ["clip-1", 2] }, context)).toEqual({
			error: "Invalid element ids",
		});
		expect(await tool.execute({ elementIds: "clip-1" }, context)).toEqual({
			error: "Invalid element ids",
		});
		expect(mockDeleteTimelineElements).not.toHaveBeenCalled();
	});
});
