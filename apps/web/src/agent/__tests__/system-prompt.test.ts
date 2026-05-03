import { describe, expect, test } from "bun:test";
import { buildSystemPrompt } from "@/agent/system-prompt";
import type { AgentContext } from "@/agent/types";

const BASE_CONTEXT: AgentContext = {
	projectId: "proj-1",
	activeSceneId: "scene-A",
	fps: null,
	duration: null,
	resolution: null,
	aspectRatio: null,
	projectName: null,
	mediaAssets: [],
	playbackTimeMs: 0,
};

describe("buildSystemPrompt", () => {
	test("includes media assets when present", () => {
		const context: AgentContext = {
			projectId: "proj-1",
			activeSceneId: "scene-A",
			fps: 30,
			duration: 60,
			resolution: { width: 1920, height: 1080 },
			aspectRatio: "16:9",
			projectName: "Test Project",
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
		expect(prompt).toContain("Test Project");
		expect(prompt).toContain("1920x1080 (16:9)");
		expect(prompt).toContain("30fps");
		expect(prompt).toContain("60s");
		expect(prompt).toContain("Active scene: scene-A");
		expect(prompt).toContain("Playback position: 15000ms");
		expect(prompt).toContain("NeuralCut video editor");
	});

	test("includes asset internal id in media listing", () => {
		const context: AgentContext = {
			projectId: "proj-1",
			activeSceneId: "scene-A",
			fps: null,
			duration: null,
			resolution: null,
			aspectRatio: null,
			projectName: null,
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
			fps: null,
			duration: null,
			resolution: null,
			aspectRatio: null,
			projectName: null,
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
			fps: null,
			duration: null,
			resolution: null,
			aspectRatio: null,
			projectName: null,
			mediaAssets: [],
			playbackTimeMs: 0,
		};

		const prompt = buildSystemPrompt(context);

		expect(prompt).toContain("No media assets loaded.");
		expect(prompt).toContain("proj-2");
		expect(prompt).toContain("No active scene");
		expect(prompt).toContain("Playback position: 0ms");
	});

	test("is valid when all fields are null/empty", () => {
		const context: AgentContext = {
			projectId: null,
			activeSceneId: null,
			fps: null,
			duration: null,
			resolution: null,
			aspectRatio: null,
			projectName: null,
			mediaAssets: [],
			playbackTimeMs: 0,
		};

		const prompt = buildSystemPrompt(context);

		expect(prompt).toContain("No project loaded");
		expect(prompt).toContain("No active scene");
		expect(prompt).toContain("No media assets loaded.");
	});

	test("includes static tool guidance in all prompts", () => {
		const prompt = buildSystemPrompt(BASE_CONTEXT);

		expect(prompt).toContain("BATCH TOOL CALLS");
		expect(prompt).toContain("load_context");
		expect(prompt).toContain("transcribe_audio");
		expect(prompt).toContain("add_text");
		expect(prompt).toContain("SKILLS");
	});

	test("includes return format guidance", () => {
		const prompt = buildSystemPrompt(BASE_CONTEXT);

		expect(prompt).toContain("success: true");
		expect(prompt).toContain("error: string");
	});

	test("includes execute mode by default", () => {
		const prompt = buildSystemPrompt(BASE_CONTEXT);

		expect(prompt).toContain("MODE: EXECUTE");
		expect(prompt).toContain("Execute edits directly");
	});

	test("includes plan mode when mode is plan", () => {
		const prompt = buildSystemPrompt(BASE_CONTEXT, "plan");

		expect(prompt).toContain("MODE: PLAN");
		expect(prompt).toContain("READ-ONLY");
	});

	test("includes execute mode when explicitly passed", () => {
		const prompt = buildSystemPrompt(BASE_CONTEXT, "execute");

		expect(prompt).toContain("MODE: EXECUTE");
	});

	test("execute mode does not force submit_plan for regular edits", () => {
		const prompt = buildSystemPrompt(BASE_CONTEXT, "execute");

		expect(prompt).not.toContain("MUST go through submit_plan");
		expect(prompt).toContain("Execute edits directly");
	});

	test("shows project metadata line with resolution, fps, and duration", () => {
		const context: AgentContext = {
			projectId: "proj-1",
			activeSceneId: "scene-A",
			fps: 30,
			duration: 45.2,
			resolution: { width: 1080, height: 1920 },
			aspectRatio: "9:16",
			projectName: "Viral Short",
			mediaAssets: [],
			playbackTimeMs: 0,
		};

		const prompt = buildSystemPrompt(context);

		expect(prompt).toContain("1080x1920 (9:16)");
		expect(prompt).toContain("30fps");
		expect(prompt).toContain("45.2s");
	});

	test("falls back to projectId when projectName is null", () => {
		const context: AgentContext = {
			projectId: "proj-abc",
			activeSceneId: "scene-A",
			fps: null,
			duration: null,
			resolution: null,
			aspectRatio: null,
			projectName: null,
			mediaAssets: [],
			playbackTimeMs: 0,
		};

		const prompt = buildSystemPrompt(context);

		expect(prompt).toContain("proj-abc");
	});

	test("omits metadata line when all metadata fields are null", () => {
		const prompt = buildSystemPrompt(BASE_CONTEXT);

		expect(prompt).not.toContain("fps");
	});
});
