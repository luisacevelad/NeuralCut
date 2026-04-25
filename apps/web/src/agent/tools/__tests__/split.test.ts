import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { AgentContext } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";

const mockSplitTimeline = mock((_args: { times: number[] }) => ({
	success: true,
	affectedElements: ["clip-1", "clip-2"],
}));

mock.module("@/agent/context", () => ({
	EditorContextAdapter: {
		splitTimeline: mockSplitTimeline,
	},
}));

await import("@/agent/tools/split.tool");

const context: AgentContext = {
	projectId: "proj-1",
	activeSceneId: "scene-A",
	mediaAssets: [],
	playbackTimeMs: 0,
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

		expect(mockSplitTimeline).toHaveBeenCalledWith({ times: [2] });
		expect(result).toEqual({
			success: true,
			affectedElements: ["clip-1", "clip-2"],
		});
	});

	test("supports multiple split times", async () => {
		const tool = toolRegistry.get("split");
		await tool.execute({ times: [2, 5, 8] }, context);

		expect(mockSplitTimeline).toHaveBeenCalledWith({ times: [2, 5, 8] });
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
