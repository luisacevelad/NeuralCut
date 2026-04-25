import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { AgentContext } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";

const mockUpdateTimelineElementTiming = mock(
	(_args: {
		elementId: string;
		start?: number;
		end?: number;
		duration?: number;
	}) => ({
		success: true,
		elementId: "element-1",
		trackId: "main",
		start: 2,
		end: 8,
		duration: 6,
	}),
);

mock.module("@/agent/context", () => ({
	EditorContextAdapter: {
		updateTimelineElementTiming: mockUpdateTimelineElementTiming,
	},
}));

await import("@/agent/tools/update-timeline-element-timing.tool");

const context: AgentContext = {
	projectId: "proj-1",
	activeSceneId: "scene-A",
	mediaAssets: [],
	playbackTimeMs: 0,
};

describe("update_timeline_element_timing tool", () => {
	beforeEach(() => {
		mockUpdateTimelineElementTiming.mockClear();
	});

	test("is registered in the tool registry", () => {
		expect(toolRegistry.has("update_timeline_element_timing")).toBe(true);
	});

	test("updates timing through the editor adapter", async () => {
		const tool = toolRegistry.get("update_timeline_element_timing");
		const result = await tool.execute(
			{ elementId: "element-1", start: 2, duration: 6 },
			context,
		);

		expect(mockUpdateTimelineElementTiming).toHaveBeenCalledWith({
			elementId: "element-1",
			start: 2,
			duration: 6,
		});
		expect(result).toEqual({
			success: true,
			elementId: "element-1",
			trackId: "main",
			start: 2,
			end: 8,
			duration: 6,
		});
	});

	test("validates timing update arguments", async () => {
		const tool = toolRegistry.get("update_timeline_element_timing");

		expect(await tool.execute({ elementId: "", duration: 1 }, context)).toEqual(
			{
				error: "Invalid element id",
			},
		);
		expect(await tool.execute({ elementId: "element-1" }, context)).toEqual({
			error: "Invalid timing update",
		});
		expect(
			await tool.execute({ elementId: "element-1", start: -1 }, context),
		).toEqual({ error: "Invalid start time" });
		expect(
			await tool.execute({ elementId: "element-1", end: 0 }, context),
		).toEqual({ error: "Invalid end time" });
		expect(
			await tool.execute({ elementId: "element-1", duration: 0 }, context),
		).toEqual({ error: "Invalid duration" });
		expect(mockUpdateTimelineElementTiming).not.toHaveBeenCalled();
	});
});
