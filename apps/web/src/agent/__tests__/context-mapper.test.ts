import { describe, expect, test } from "bun:test";
import { buildContextFromEditorState } from "@/agent/context-mapper";

describe("buildContextFromEditorState (context mapper)", () => {
	test("maps active media populated from editor", () => {
		const ctx = buildContextFromEditorState({
			project: { metadata: { id: "proj-1" } },
			activeScene: { id: "scene-A" },
			assets: [
				{ id: "m1", name: "intro.mp4", type: "video", duration: 30 },
				{ id: "m2", name: "bgm.mp3", type: "audio", duration: 180 },
			],
			currentTimeTicks: 1500,
			ticksPerSecond: 100,
		});

		expect(ctx.projectId).toBe("proj-1");
		expect(ctx.activeSceneId).toBe("scene-A");
		expect(ctx.mediaAssets).toHaveLength(2);
		expect(ctx.mediaAssets[0]).toEqual({
			id: "m1",
			name: "intro.mp4",
			type: "video",
			duration: 30,
		});
		expect(ctx.mediaAssets[1]).toEqual({
			id: "m2",
			name: "bgm.mp3",
			type: "audio",
			duration: 180,
		});
		expect(ctx.playbackTimeMs).toBe(15000);
	});

	test("returns null projectId when no project loaded", () => {
		const ctx = buildContextFromEditorState({
			project: null,
			activeScene: null,
			assets: [],
			currentTimeTicks: 0,
			ticksPerSecond: 100,
		});

		expect(ctx.projectId).toBeNull();
		expect(ctx.activeSceneId).toBeNull();
		expect(ctx.mediaAssets).toEqual([]);
		expect(ctx.playbackTimeMs).toBe(0);
	});

	test("handles assets with undefined duration", () => {
		const ctx = buildContextFromEditorState({
			project: { metadata: { id: "proj-2" } },
			activeScene: { id: "scene-B" },
			assets: [{ id: "m1", name: "unknown.dat", type: "other" }],
			currentTimeTicks: 500,
			ticksPerSecond: 100,
		});

		expect(ctx.mediaAssets[0].duration).toBe(0);
	});

	test("calculates playbackTimeMs from ticks correctly", () => {
		const ctx = buildContextFromEditorState({
			project: { metadata: { id: "p" } },
			activeScene: null,
			assets: [],
			currentTimeTicks: 3000,
			ticksPerSecond: 100,
		});

		// 3000 ticks / 100 tps = 30 seconds = 30000ms
		expect(ctx.playbackTimeMs).toBe(30000);
	});

	test("result is JSON-serializable", () => {
		const ctx = buildContextFromEditorState({
			project: { metadata: { id: "proj-1" } },
			activeScene: { id: "s1" },
			assets: [
				{ id: "m1", name: "a.mp4", type: "video", duration: 10 },
			],
			currentTimeTicks: 100,
			ticksPerSecond: 100,
		});

		const json = JSON.stringify(ctx);
		const parsed = JSON.parse(json);
		expect(parsed).toEqual(ctx);
	});

	test("handles empty assets list", () => {
		const ctx = buildContextFromEditorState({
			project: { metadata: { id: "proj-1" } },
			activeScene: null,
			assets: [],
			currentTimeTicks: 0,
			ticksPerSecond: 100,
		});

		expect(ctx.mediaAssets).toEqual([]);
	});
});
