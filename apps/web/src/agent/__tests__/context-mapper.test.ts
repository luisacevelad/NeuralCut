import { describe, expect, test } from "bun:test";
import { buildContextFromEditorState } from "@/agent/context-mapper";

describe("buildContextFromEditorState (context mapper)", () => {
	test("maps active media populated from editor", () => {
		const ctx = buildContextFromEditorState({
			project: {
				metadata: {
					id: "proj-1",
					name: "My Project",
					duration: 45.2,
				},
				settings: {
					fps: { numerator: 30, denominator: 1 },
					canvasSize: { width: 1080, height: 1920 },
				},
			},
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
		expect(ctx.fps).toBe(30);
		expect(ctx.duration).toBe(45.2);
		expect(ctx.resolution).toEqual({ width: 1080, height: 1920 });
		expect(ctx.aspectRatio).toBe("9:16");
		expect(ctx.projectName).toBe("My Project");
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
		expect(ctx.fps).toBeNull();
		expect(ctx.duration).toBeNull();
		expect(ctx.resolution).toBeNull();
		expect(ctx.aspectRatio).toBeNull();
		expect(ctx.projectName).toBeNull();
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
								startTime: 200,
								duration: 500,
								transform: {
									position: { x: 10, y: 20 },
									scaleX: 1.5,
									scaleY: 1.5,
									rotate: 45,
								},
								opacity: 80,
								volume: -3,
								muted: false,
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
									content: "Hello world",
									startTime: 300,
									duration: 200,
									transform: {
										position: { x: 0, y: -35 },
										scaleX: 1,
										scaleY: 1,
										rotate: 0,
									},
									opacity: 100,
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
									duration: 1000,
									volume: -10,
									muted: true,
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
				trackId: "text-track",
				trackRef: "text-1",
				trackLabel: "Text",
				type: "text",
				position: 0,
				visualLayer: 1,
				isVisualLayer: true,
				stacking: "top",
				elements: [
					{
						elementId: "text-1",
						ref: "text-1",
						displayName: "Text: Hello world",
						type: "text",
						name: "Caption",
						content: "Hello world",
						duration: 2,
						start: 3,
						end: 5,
						positionX: 0,
						positionY: -35,
						scaleX: 1,
						scaleY: 1,
						rotation: 0,
						opacity: 100,
					},
				],
			},
			{
				trackId: "main-track",
				trackRef: "main-1",
				trackLabel: "Main",
				type: "main",
				position: 1,
				visualLayer: 0,
				isVisualLayer: true,
				stacking: "main",
				elements: [
					{
						elementId: "clip-1",
						ref: "clip-1",
						displayName: "Intro",
						type: "video",
						assetId: "m1",
						name: "Intro",
						duration: 5,
						start: 2,
						end: 7,
						positionX: 10,
						positionY: 20,
						scaleX: 1.5,
						scaleY: 1.5,
						rotation: 45,
						opacity: 80,
						volume: -3,
						muted: false,
					},
				],
			},
			{
				trackId: "audio-track",
				trackRef: "audio-1",
				trackLabel: "Audio",
				type: "audio",
				position: 2,
				visualLayer: null,
				isVisualLayer: false,
				stacking: "audio",
				elements: [
					{
						elementId: "music-1",
						ref: "clip-2",
						displayName: "Music",
						type: "audio",
						assetId: "m2",
						name: "Music",
						duration: 10,
						start: 0,
						end: 10,
						volume: -10,
						muted: true,
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

	test("computes aspect ratio from resolution via GCD", () => {
		const ctx = buildContextFromEditorState({
			project: {
				metadata: { id: "proj-1" },
				settings: {
					fps: { numerator: 60, denominator: 1 },
					canvasSize: { width: 1920, height: 1080 },
				},
			},
			activeScene: null,
			assets: [],
			currentTimeTicks: 0,
			ticksPerSecond: 100,
		});

		expect(ctx.aspectRatio).toBe("16:9");
		expect(ctx.fps).toBe(60);
		expect(ctx.resolution).toEqual({ width: 1920, height: 1080 });
	});

	test("handles NTSC fractional frame rates", () => {
		const ctx = buildContextFromEditorState({
			project: {
				metadata: { id: "proj-1" },
				settings: {
					fps: { numerator: 30_000, denominator: 1_001 },
					canvasSize: { width: 1920, height: 1080 },
				},
			},
			activeScene: null,
			assets: [],
			currentTimeTicks: 0,
			ticksPerSecond: 100,
		});

		expect(ctx.fps).toBeCloseTo(29.97002997, 4);
	});

	test("returns null metadata fields when project has no settings", () => {
		const ctx = buildContextFromEditorState({
			project: { metadata: { id: "proj-1" } },
			activeScene: null,
			assets: [],
			currentTimeTicks: 0,
			ticksPerSecond: 100,
		});

		expect(ctx.fps).toBeNull();
		expect(ctx.resolution).toBeNull();
		expect(ctx.aspectRatio).toBeNull();
		expect(ctx.projectName).toBeNull();
	});
});
