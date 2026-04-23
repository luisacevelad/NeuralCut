import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { AgentContext } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";

// bun:test exposes jest.fn() for mock function creation at runtime
// We type the factory explicitly to avoid referencing the `jest` global type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockFn = {
	(...args: any[]): any;
	mockReturnValue(value: any): void;
	mockResolvedValue(value: any): void;
	mockClear(): void;
	mockImplementation(fn: (...args: any[]) => any): void;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockFnFactory = <T extends (...args: any[]) => any>() => T & MockFn;

const bunTestModule = await import("bun:test");
const jestObj = (bunTestModule as Record<string, unknown>).jest as Record<string, unknown>;
const mockFn = jestObj.fn as unknown as MockFnFactory;

// --- Module mocks for tool dependencies ---

const mockResolveAssetFile = mockFn<(assetId?: string) => File | null>();
const mockGetAssetHasAudio = mockFn<(assetId: string) => boolean | undefined>();
const mockDecodeAudio = mockFn();
const mockTranscribe = mockFn();

mock.module("@/agent/context", () => ({
	EditorContextAdapter: {
		resolveAssetFile: mockResolveAssetFile,
		getAssetHasAudio: mockGetAssetHasAudio,
	},
	buildSystemPrompt: () => "",
}));

mock.module("@/lib/media/audio", () => ({
	decodeAudioToFloat32: mockDecodeAudio,
}));

mock.module("@/services/transcription/service", () => ({
	transcriptionService: {
		transcribe: mockTranscribe,
	},
}));

// Import the tool module to trigger side-effect registration
await import("@/agent/tools/transcribe-video.tool");

// --- Helpers ---

function makeContext(
	overrides: Partial<AgentContext> = {},
): AgentContext {
	return {
		projectId: "proj-1",
		activeSceneId: "scene-A",
		mediaAssets: [],
		playbackTimeMs: 0,
		...overrides,
	};
}

function fakeVideoAsset(
	overrides: Partial<{ id: string; name: string; type: string; duration: number }> = {},
) {
	return {
		id: "v1",
		name: "clip.mp4",
		type: "video",
		duration: 30,
		...overrides,
	};
}

function fakeTranscriptionResult() {
	return {
		text: "Hello world, this is a test.",
		segments: [
			{ text: "Hello world,", start: 0, end: 2.5 },
			{ text: "this is a test.", start: 2.5, end: 5.0 },
		],
		language: "en",
	};
}

// --- Tests ---

describe("transcribe_video tool — registration (contract)", () => {
	test("is registered in the tool registry", () => {
		expect(toolRegistry.has("transcribe_video")).toBe(true);
	});

	test("has correct name and description", () => {
		const tool = toolRegistry.get("transcribe_video");
		expect(tool.name).toBe("transcribe_video");
		expect(tool.description).toContain("transcri");
	});

	test("declares assetId as optional parameter", () => {
		const tool = toolRegistry.get("transcribe_video");
		const assetIdParam = tool.parameters.find((p) => p.key === "assetId");
		expect(assetIdParam).toBeDefined();
		expect(assetIdParam!.required).toBe(false);
	});
});

describe("transcribe_video tool — success path", () => {
	beforeEach(() => {
		mockResolveAssetFile.mockClear();
		mockGetAssetHasAudio.mockClear();
		mockDecodeAudio.mockClear();
		mockTranscribe.mockClear();
	});

	test("transcribes a single video asset successfully", async () => {
		const fakeFile = new File([], "clip.mp4", { type: "video/mp4" });
		const context = makeContext({
			mediaAssets: [fakeVideoAsset()],
		});

		mockResolveAssetFile.mockReturnValue(fakeFile);
		mockGetAssetHasAudio.mockReturnValue(true);
		mockDecodeAudio.mockResolvedValue({
			samples: new Float32Array(16000),
			sampleRate: 16000,
		});
		mockTranscribe.mockResolvedValue(fakeTranscriptionResult());

		const tool = toolRegistry.get("transcribe_video");
		const result = await tool.execute({}, context);

		// Verify result shape
		expect(result).toEqual({
			assetName: "clip.mp4",
			language: "en",
			fullText: "Hello world, this is a test.",
			segmentCount: 2,
			segments: fakeTranscriptionResult().segments,
			duration: 30,
		});

		// Verify the adapter was called with the correct asset id
		expect(mockResolveAssetFile).toHaveBeenCalledWith("v1");
		expect(mockGetAssetHasAudio).toHaveBeenCalledWith("v1");
	});

	test("transcribes with explicit assetId", async () => {
		const fakeFile = new File([], "other.mp4", { type: "video/mp4" });
		const context = makeContext({
			mediaAssets: [
				fakeVideoAsset({ id: "v1", name: "first.mp4" }),
				fakeVideoAsset({ id: "v2", name: "other.mp4" }),
			],
		});

		mockResolveAssetFile.mockReturnValue(fakeFile);
		mockGetAssetHasAudio.mockReturnValue(true);
		mockDecodeAudio.mockResolvedValue({
			samples: new Float32Array(16000),
			sampleRate: 16000,
		});
		mockTranscribe.mockResolvedValue(fakeTranscriptionResult());

		const tool = toolRegistry.get("transcribe_video");
		const result = await tool.execute({ assetId: "v2" }, context);

		expect(result).toEqual(
			expect.objectContaining({ assetName: "other.mp4" }),
		);
		expect(mockResolveAssetFile).toHaveBeenCalledWith("v2");
	});
});

describe("transcribe_video tool — error branches", () => {
	beforeEach(() => {
		mockResolveAssetFile.mockClear();
		mockGetAssetHasAudio.mockClear();
		mockDecodeAudio.mockClear();
		mockTranscribe.mockClear();
	});

	test("returns error when no media assets in project", async () => {
		const context = makeContext({ mediaAssets: [] });
		const tool = toolRegistry.get("transcribe_video");

		const result = await tool.execute({}, context);
		expect(result).toEqual({ error: "No active media asset" });
	});

	test("returns error when only image assets found (no audio track)", async () => {
		const context = makeContext({
			mediaAssets: [
				{ id: "img1", name: "photo.jpg", type: "image", duration: 0 },
			],
		});
		const tool = toolRegistry.get("transcribe_video");

		const result = await tool.execute({}, context);
		expect(result).toEqual({ error: "Asset has no audio track" });
	});

	test("returns error when multiple candidates but no assetId", async () => {
		const context = makeContext({
			mediaAssets: [
				fakeVideoAsset({ id: "v1", name: "intro.mp4" }),
				fakeVideoAsset({ id: "v2", name: "outro.mp4" }),
			],
		});
		const tool = toolRegistry.get("transcribe_video");

		const result = await tool.execute({}, context);
		expect(result).toEqual({
			error: "Multiple video/audio assets found: intro.mp4, outro.mp4. Specify which one with assetId.",
		});
	});

	test("returns error when specified assetId not in candidates", async () => {
		const context = makeContext({
			mediaAssets: [
				fakeVideoAsset({ id: "v1", name: "intro.mp4" }),
			],
		});
		const tool = toolRegistry.get("transcribe_video");

		const result = await tool.execute({ assetId: "v99" }, context);
		expect(result).toEqual({
			error: "Could not access file for asset v99",
		});
	});

	test("returns error when resolveAssetFile returns null", async () => {
		const context = makeContext({
			mediaAssets: [fakeVideoAsset()],
		});

		mockResolveAssetFile.mockReturnValue(null);

		const tool = toolRegistry.get("transcribe_video");
		const result = await tool.execute({}, context);

		expect(result).toEqual({ error: "Could not access file for asset v1" });
	});

	test("returns error when asset has no audio track", async () => {
		const fakeFile = new File([], "silent.mp4", { type: "video/mp4" });
		const context = makeContext({
			mediaAssets: [fakeVideoAsset({ name: "silent.mp4" })],
		});

		mockResolveAssetFile.mockReturnValue(fakeFile);
		mockGetAssetHasAudio.mockReturnValue(false);

		const tool = toolRegistry.get("transcribe_video");
		const result = await tool.execute({}, context);

		expect(result).toEqual({ error: "Asset has no audio track" });
	});

	test("returns error when transcriptionService.transcribe rejects", async () => {
		const fakeFile = new File([], "clip.mp4", { type: "video/mp4" });
		const context = makeContext({
			mediaAssets: [fakeVideoAsset()],
		});

		mockResolveAssetFile.mockReturnValue(fakeFile);
		mockGetAssetHasAudio.mockReturnValue(true);
		mockDecodeAudio.mockResolvedValue({
			samples: new Float32Array(16000),
			sampleRate: 16000,
		});
		mockTranscribe.mockImplementation(() =>
			Promise.reject(new Error("Worker not initialized")),
		);

		const tool = toolRegistry.get("transcribe_video");
		const result = await tool.execute({}, context);

		// Tool catches service errors and returns { error } per spec
		expect(result).toEqual({ error: "Worker not initialized" });
	});
});
