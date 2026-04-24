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
			usedInTimeline: false,
		});
		expect(ctx.mediaAssets[1]).toEqual({
			id: "m2",
			name: "bgm.mp3",
			type: "audio",
			duration: 180,
			usedInTimeline: false,
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

	test("marks media assets used by the active timeline", () => {
		const ctx = buildContextFromEditorState({
			project: { metadata: { id: "proj-1" } },
			activeScene: {
				id: "scene-A",
				tracks: {
					main: { id: "main", type: "video", elements: [{ mediaId: "m1" }] },
					overlay: [
						{ id: "overlay", type: "video", elements: [{ mediaId: "m3" }] },
					],
					audio: [
						{ id: "audio", type: "audio", elements: [{ mediaId: "m2" }] },
					],
				},
			},
			assets: [
				{ id: "m1", name: "intro.mp4", type: "video", duration: 30 },
				{ id: "m2", name: "bgm.mp3", type: "audio", duration: 180 },
				{ id: "m4", name: "unused.png", type: "image" },
			],
			currentTimeTicks: 0,
			ticksPerSecond: 100,
		});

		expect(ctx.mediaAssets.map((asset) => asset.usedInTimeline)).toEqual([
			true,
			true,
			false,
		]);
	});

	test("maps active timeline tracks for agent tools", () => {
		const ctx = buildContextFromEditorState({
			project: { metadata: { id: "proj-1" } },
			activeScene: {
				id: "scene-A",
				tracks: {
					main: {
						id: "main-track",
						type: "video",
						elements: [
							{
								id: "clip-1",
								type: "video",
								mediaId: "m1",
								name: "Intro",
								startTime: 2,
								duration: 5,
							},
						],
					},
					overlay: [
						{
							id: "text-track",
							type: "text",
							elements: [
								{
									id: "text-1",
									type: "text",
									name: "Caption",
									startTime: 3,
									duration: 2,
								},
							],
						},
					],
					audio: [
						{
							id: "audio-track",
							type: "audio",
							elements: [
								{
									id: "music-1",
									type: "audio",
									mediaId: "m2",
									name: "Music",
									startTime: 0,
									duration: 10,
								},
							],
						},
					],
				},
			},
			assets: [],
			currentTimeTicks: 0,
			ticksPerSecond: 100,
		});

		expect(ctx.timelineTracks).toEqual([
			{
				trackId: "main-track",
				type: "main",
				elements: [
					{
						elementId: "clip-1",
						type: "video",
						assetId: "m1",
						name: "Intro",
						start: 2,
						end: 7,
					},
				],
			},
			{
				trackId: "text-track",
				type: "text",
				elements: [
					{
						elementId: "text-1",
						type: "text",
						name: "Caption",
						start: 3,
						end: 5,
					},
				],
			},
			{
				trackId: "audio-track",
				type: "audio",
				elements: [
					{
						elementId: "music-1",
						type: "audio",
						assetId: "m2",
						name: "Music",
						start: 0,
						end: 10,
					},
				],
			},
		]);
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
			assets: [{ id: "m1", name: "a.mp4", type: "video", duration: 10 }],
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
