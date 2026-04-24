import { describe, expect, test } from "bun:test";
import { buildSystemPrompt } from "@/agent/system-prompt";
import type { AgentContext } from "@/agent/types";

const BASE_CONTEXT: AgentContext = {
	projectId: "proj-1",
	activeSceneId: "scene-A",
	mediaAssets: [],
	playbackTimeMs: 0,
};

describe("buildSystemPrompt", () => {
	// -----------------------------------------------------------------------
	// Media context
	// -----------------------------------------------------------------------

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

	test("includes asset internal id in media listing", () => {
		const context: AgentContext = {
			projectId: "proj-1",
			activeSceneId: "scene-A",
			mediaAssets: [
				{ id: "m1", name: "intro.mp4", type: "video", duration: 30 },
			],
			playbackTimeMs: 0,
		};

		const prompt = buildSystemPrompt(context);

		expect(prompt).toContain("[id: m1]");
	});

	test("includes assetId instruction when media assets are present", () => {
		const context: AgentContext = {
			projectId: "proj-1",
			activeSceneId: "scene-A",
			mediaAssets: [
				{ id: "m1", name: "conclu.mov", type: "video", duration: 60 },
			],
			playbackTimeMs: 0,
		};

		const prompt = buildSystemPrompt(context);

		expect(prompt).toContain("IMPORTANT");
		expect(prompt).toContain("assetId");
		expect(prompt).toContain('internal "id" value');
		expect(prompt).toContain("NOT the filename");
	});

	test("omits assetId instruction when no media assets", () => {
		const prompt = buildSystemPrompt(BASE_CONTEXT);

		expect(prompt).not.toContain("IMPORTANT");
		expect(prompt).not.toContain("assetId");
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

	// -----------------------------------------------------------------------
	// Tool guidance
	// -----------------------------------------------------------------------

	test("includes tool guidance section when tools are provided", () => {
		const tools = [
			{ name: "transcribe_video", description: "Transcribes video audio" },
		];

		const prompt = buildSystemPrompt(BASE_CONTEXT, tools);

		expect(prompt).toContain("Available tools:");
		expect(prompt).toContain("transcribe_video");
		expect(prompt).toContain("Transcribes video audio");
	});

	test("includes plain-text fallback instruction when tools are provided", () => {
		const tools = [
			{ name: "transcribe_video", description: "Transcribes video audio" },
		];

		const prompt = buildSystemPrompt(BASE_CONTEXT, tools);

		expect(prompt).toContain("plain text");
	});

	test("lists multiple tools when provided", () => {
		const tools = [
			{ name: "transcribe_video", description: "Transcribes audio" },
			{ name: "analyze_scene", description: "Analyzes scene content" },
		];

		const prompt = buildSystemPrompt(BASE_CONTEXT, tools);

		expect(prompt).toContain("transcribe_video");
		expect(prompt).toContain("analyze_scene");
	});

	test("omits tool guidance when no tools are provided", () => {
		const prompt = buildSystemPrompt(BASE_CONTEXT);

		expect(prompt).not.toContain("Available tools:");
		expect(prompt).not.toContain("plain text");
	});

	test("omits tool guidance when tools array is empty", () => {
		const prompt = buildSystemPrompt(BASE_CONTEXT, []);

		expect(prompt).not.toContain("Available tools:");
	});
});
