import { beforeEach, describe, expect, mock, test } from "bun:test";

// --- Module mocks (must be set up before importing the module under test) ---

// bun:test exposes jest.fn() for mock function creation at runtime
// We type the factory explicitly to avoid referencing the `jest` global type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockFn = {
	(...args: any[]): any;
	mockReturnValue(value: any): void;
	mockClear(): void;
	mockImplementation(fn: (...args: any[]) => any): void;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockFnFactory = <T extends (...args: any[]) => any>() => T & MockFn;

const bunTestModule = await import("bun:test");
const jestObj = (bunTestModule as Record<string, unknown>).jest as Record<string, unknown>;
const mockFn = jestObj.fn as unknown as MockFnFactory;

const mockGetAssets = mockFn<() => any[]>();

mock.module("@/core", () => ({
	EditorCore: {
		getInstance: () => ({
			media: { getAssets: mockGetAssets },
		}),
	},
}));

mock.module("@/lib/wasm", () => ({
	TICKS_PER_SECOND: 100,
}));

const { EditorContextAdapter } = await import("@/agent/context");

// --- Helpers ---

function fakeAsset(
	overrides: Partial<{
		id: string;
		name: string;
		type: string;
		duration: number;
		file: File;
		hasAudio: boolean;
	}> = {},
) {
	return {
		id: "v1",
		name: "clip.mp4",
		type: "video",
		duration: 30,
		file: new File([], "clip.mp4", { type: "video/mp4" }),
		hasAudio: true,
		...overrides,
	};
}

// --- Tests ---

describe("EditorContextAdapter.resolveAssetFile", () => {
	beforeEach(() => {
		mockGetAssets.mockClear();
	});

	test("returns File when assetId matches an asset", () => {
		const videoFile = new File([], "intro.mp4", { type: "video/mp4" });
		mockGetAssets.mockReturnValue([
			fakeAsset({ id: "v1", name: "intro.mp4", file: videoFile }),
		]);

		const result = EditorContextAdapter.resolveAssetFile("v1");
		expect(result).toBe(videoFile);
	});

	test("returns null when assetId does not match any asset", () => {
		mockGetAssets.mockReturnValue([
			fakeAsset({ id: "v1", name: "intro.mp4" }),
		]);

		const result = EditorContextAdapter.resolveAssetFile("nonexistent");
		expect(result).toBeNull();
	});

	test("returns File for first video asset when no assetId provided", () => {
		const videoFile = new File([], "clip.mp4", { type: "video/mp4" });
		mockGetAssets.mockReturnValue([
			fakeAsset({ id: "img1", name: "photo.jpg", type: "image", file: new File([], "p.jpg") }),
			fakeAsset({ id: "v1", name: "clip.mp4", type: "video", file: videoFile }),
		]);

		const result = EditorContextAdapter.resolveAssetFile();
		expect(result).toBe(videoFile);
	});

	test("returns File for first audio asset when no assetId and no video assets", () => {
		const audioFile = new File([], "song.mp3", { type: "audio/mpeg" });
		mockGetAssets.mockReturnValue([
			fakeAsset({ id: "img1", name: "photo.jpg", type: "image", file: new File([], "p.jpg") }),
			fakeAsset({ id: "a1", name: "song.mp3", type: "audio", file: audioFile }),
		]);

		const result = EditorContextAdapter.resolveAssetFile();
		expect(result).toBe(audioFile);
	});

	test("returns null when assets array is empty", () => {
		mockGetAssets.mockReturnValue([]);

		const result = EditorContextAdapter.resolveAssetFile();
		expect(result).toBeNull();
	});

	test("returns null when no video or audio assets exist and no assetId", () => {
		mockGetAssets.mockReturnValue([
			fakeAsset({ id: "img1", name: "photo.jpg", type: "image" }),
		]);

		const result = EditorContextAdapter.resolveAssetFile();
		expect(result).toBeNull();
	});

	test("returns null when matching asset has no file property", () => {
		mockGetAssets.mockReturnValue([
			{ id: "v1", name: "clip.mp4", type: "video" },
		]);

		const result = EditorContextAdapter.resolveAssetFile("v1");
		expect(result).toBeNull();
	});
});

describe("EditorContextAdapter.getAssetHasAudio", () => {
	beforeEach(() => {
		mockGetAssets.mockClear();
	});

	test("returns true when asset has audio", () => {
		mockGetAssets.mockReturnValue([
			fakeAsset({ id: "v1", hasAudio: true }),
		]);

		expect(EditorContextAdapter.getAssetHasAudio("v1")).toBe(true);
	});

	test("returns false when asset has no audio", () => {
		mockGetAssets.mockReturnValue([
			fakeAsset({ id: "v1", hasAudio: false }),
		]);

		expect(EditorContextAdapter.getAssetHasAudio("v1")).toBe(false);
	});

	test("returns undefined when asset is not found", () => {
		mockGetAssets.mockReturnValue([]);

		expect(EditorContextAdapter.getAssetHasAudio("nonexistent")).toBeUndefined();
	});
});
