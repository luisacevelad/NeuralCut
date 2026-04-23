import { describe, expect, test } from "bun:test";
import "@/agent/tools/mock.tool";
import { toolRegistry } from "@/agent/tools/registry";
import type { AgentContext } from "@/agent/types";

describe("echo_context tool", () => {
	test("is registered in the tool registry", () => {
		expect(toolRegistry.has("echo_context")).toBe(true);
	});

	test("returns context summary with media assets", async () => {
		const context: AgentContext = {
			projectId: "proj-1",
			activeSceneId: "scene-A",
			mediaAssets: [
				{ id: "m1", name: "clip.mp4", type: "video", duration: 120 },
				{ id: "m2", name: "song.mp3", type: "audio", duration: 45 },
			],
			playbackTimeMs: 5000,
		};

		const tool = toolRegistry.get("echo_context");
		const result = await tool.execute({}, context);

		expect(result).toEqual({
			projectId: "proj-1",
			activeSceneId: "scene-A",
			mediaCount: 2,
			mediaNames: ["clip.mp4", "song.mp3"],
			playbackTimeMs: 5000,
		});
	});

	test("returns valid result with no media assets", async () => {
		const context: AgentContext = {
			projectId: null,
			activeSceneId: null,
			mediaAssets: [],
			playbackTimeMs: 0,
		};

		const tool = toolRegistry.get("echo_context");
		const result = await tool.execute({}, context);

		expect(result).toEqual({
			projectId: null,
			activeSceneId: null,
			mediaCount: 0,
			mediaNames: [],
			playbackTimeMs: 0,
		});
	});

	test("ignores unused args", async () => {
		const context: AgentContext = {
			projectId: "proj-2",
			activeSceneId: null,
			mediaAssets: [],
			playbackTimeMs: 0,
		};

		const tool = toolRegistry.get("echo_context");
		const result = await tool.execute({ extra: "ignored" }, context);

		expect(result).toEqual({
			projectId: "proj-2",
			activeSceneId: null,
			mediaCount: 0,
			mediaNames: [],
			playbackTimeMs: 0,
		});
	});
});
