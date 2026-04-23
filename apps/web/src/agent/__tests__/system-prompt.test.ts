import { describe, expect, test } from "bun:test";
import { buildSystemPrompt } from "@/agent/system-prompt";
import type { AgentContext } from "@/agent/types";

describe("buildSystemPrompt", () => {
	test("includes media assets when present", () => {
		const context: AgentContext = {
			projectId: "proj-1",
			activeSceneId: "scene-A",
			mediaAssets: [
				{ id: "m1", name: "intro.mp4", type: "video", duration: 30 },
				{ id: "m2", name: "bgm.mp3", type: "audio", duration: 180 },
			],
			playbackTimeMs: 15000,
		};

		const prompt = buildSystemPrompt(context);

		expect(prompt).toContain("intro.mp4");
		expect(prompt).toContain("bgm.mp3");
		expect(prompt).toContain("video, 30s");
		expect(prompt).toContain("audio, 180s");
		expect(prompt).toContain("Project: proj-1");
		expect(prompt).toContain("Active scene: scene-A");
		expect(prompt).toContain("Playback position: 15000ms");
		expect(prompt).toContain("NeuralCut video editor");
	});

	test("is valid when no media assets are loaded", () => {
		const context: AgentContext = {
			projectId: "proj-2",
			activeSceneId: null,
			mediaAssets: [],
			playbackTimeMs: 0,
		};

		const prompt = buildSystemPrompt(context);

		expect(prompt).toContain("No media assets loaded.");
		expect(prompt).toContain("Project: proj-2");
		expect(prompt).toContain("No active scene");
		expect(prompt).toContain("Playback position: 0ms");
	});

	test("is valid when all fields are null/empty", () => {
		const context: AgentContext = {
			projectId: null,
			activeSceneId: null,
			mediaAssets: [],
			playbackTimeMs: 0,
		};

		const prompt = buildSystemPrompt(context);

		expect(prompt).toContain("No project loaded");
		expect(prompt).toContain("No active scene");
		expect(prompt).toContain("No media assets loaded.");
	});
});
