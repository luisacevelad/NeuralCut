import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { AgentContext } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";

const mockAddMediaToTimeline = mock(
	(_args: {
		assetId: string;
		startTime: number;
		trackType: string;
		duration?: number;
	}) => ({
		elementId: "element-1",
		trackId: "main",
	}),
);

mock.module("@/agent/context", () => ({
	EditorContextAdapter: {
		addMediaToTimeline: mockAddMediaToTimeline,
	},
}));

await import("@/agent/tools/add-media-to-timeline.tool");

const context: AgentContext = {
	projectId: "proj-1",
	activeSceneId: "scene-A",
	mediaAssets: [],
	playbackTimeMs: 0,
};

describe("add_media_to_timeline tool", () => {
	beforeEach(() => {
		mockAddMediaToTimeline.mockClear();
	});

	test("is registered in the tool registry", () => {
		expect(toolRegistry.has("add_media_to_timeline")).toBe(true);
	});

	test("adds media through the editor adapter", async () => {
		const tool = toolRegistry.get("add_media_to_timeline");
		const result = await tool.execute(
			{ assetId: "asset-1", startTime: 2, trackType: "main" },
			context,
		);

		expect(mockAddMediaToTimeline).toHaveBeenCalledWith({
			assetId: "asset-1",
			startTime: 2,
			trackType: "main",
		});
		expect(result).toEqual({ elementId: "element-1", trackId: "main" });
	});

	test("passes optional duration through the editor adapter", async () => {
		const tool = toolRegistry.get("add_media_to_timeline");
		await tool.execute(
			{ assetId: "asset-1", startTime: 2, trackType: "overlay", duration: 6 },
			context,
		);

		expect(mockAddMediaToTimeline).toHaveBeenCalledWith({
			assetId: "asset-1",
			startTime: 2,
			trackType: "overlay",
			duration: 6,
		});
	});

	test("validates add media arguments", async () => {
		const tool = toolRegistry.get("add_media_to_timeline");

		expect(
			await tool.execute(
				{ assetId: "", startTime: 0, trackType: "main" },
				context,
			),
		).toEqual({ error: "Asset not found" });
		expect(
			await tool.execute(
				{ assetId: "asset-1", startTime: -1, trackType: "main" },
				context,
			),
		).toEqual({ error: "Invalid start time" });
		expect(
			await tool.execute(
				{ assetId: "asset-1", startTime: 0, trackType: "text" },
				context,
			),
		).toEqual({ error: "Invalid track type for asset" });
		expect(
			await tool.execute(
				{ assetId: "asset-1", startTime: 0, trackType: "main", duration: 0 },
				context,
			),
		).toEqual({ error: "Invalid duration" });
		expect(mockAddMediaToTimeline).not.toHaveBeenCalled();
	});
});
