import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { AgentContext } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";

const mockResolveAssetFile = mock<(assetId?: string) => File | null>();

mock.module("@/agent/context", () => ({
	EditorContextAdapter: {
		resolveAssetFile: mockResolveAssetFile,
	},
}));

await import("@/agent/tools/load-context.tool");

const originalFetch = globalThis.fetch;

function makeContext(overrides: Partial<AgentContext> = {}): AgentContext {
	return {
		projectId: "proj-1",
		activeSceneId: "scene-A",
		mediaAssets: [
			{
				id: "asset-video",
				name: "intro.mp4",
				type: "video",
				duration: 30,
				usedInTimeline: true,
			},
		],
		timelineTracks: [
			{
				trackId: "text-track",
				type: "text",
				position: 0,
				visualLayer: 1,
				isVisualLayer: true,
				stacking: "top",
				elements: [
					{
						elementId: "caption-1",
						type: "text",
						name: "Caption",
						content: "Hello Gemini",
						start: 1,
						end: 3,
					},
				],
			},
			{
				trackId: "main-track",
				type: "main",
				position: 1,
				visualLayer: 0,
				isVisualLayer: true,
				stacking: "main",
				elements: [
					{
						elementId: "clip-1",
						type: "video",
						assetId: "asset-video",
						name: "Intro clip",
						start: 5,
						end: 15,
					},
				],
			},
		],
		playbackTimeMs: 0,
		...overrides,
	};
}

function mockGeminiUploadResponse() {
	globalThis.fetch = mock(() =>
		Promise.resolve(
			new Response(
				JSON.stringify({
					provider: "gemini",
					status: "loaded",
					fileName: "files/abc",
					fileUri: "gemini://files/abc",
					mimeType: "video/mp4",
					displayName: "intro.mp4",
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			),
		),
	) as unknown as typeof fetch;
}

describe("load_context tool", () => {
	beforeEach(() => {
		mockResolveAssetFile.mockReset();
		globalThis.fetch = originalFetch;
	});

	test("is registered in the tool registry", () => {
		expect(toolRegistry.has("load_context")).toBe(true);
	});

	test("loads text timeline elements as exact structured context", async () => {
		const tool = toolRegistry.get("load_context");
		const result = await tool.execute(
			{
				targetType: "timeline_element",
				trackId: "text-track",
				elementId: "caption-1",
			},
			makeContext(),
		);

		expect(result).toEqual({
			targetType: "timeline_element",
			id: "caption-1",
			status: "loaded",
			cached: false,
			provider: "gemini",
			context: {
				kind: "text",
				trackId: "text-track",
				elementId: "caption-1",
				type: "text",
				name: "Caption",
				content: "Hello Gemini",
				start: 1,
				end: 3,
			},
		});
		expect(mockResolveAssetFile).not.toHaveBeenCalled();
	});

	test("uploads media assets through the server endpoint", async () => {
		const file = new File(["fake"], "intro.mp4", { type: "video/mp4" });
		mockResolveAssetFile.mockReturnValue(file);
		mockGeminiUploadResponse();

		const tool = toolRegistry.get("load_context");
		const result = await tool.execute(
			{ targetType: "asset", assetId: "asset-video" },
			makeContext(),
		);

		expect(result).toEqual({
			targetType: "asset",
			id: "asset-video",
			status: "loaded",
			cached: false,
			provider: "gemini",
			context: {
				kind: "media",
				assetId: "asset-video",
				assetName: "intro.mp4",
				assetType: "video",
				duration: 30,
				fileUri: "gemini://files/abc",
				mimeType: "video/mp4",
				fileName: "files/abc",
				displayName: "intro.mp4",
			},
		});
		expect(mockResolveAssetFile).toHaveBeenCalledWith("asset-video");
	});

	test("sends inferred MIME type when the file type is octet-stream", async () => {
		const file = new File(["fake"], "stored-asset", {
			type: "application/octet-stream",
		});
		mockResolveAssetFile.mockReturnValue(file);

		const uploaded: { mimeType: FormDataEntryValue | null } = { mimeType: null };
		globalThis.fetch = mock((_, init) => {
			uploaded.mimeType =
				init?.body instanceof FormData ? init.body.get("mimeType") : null;
			return Promise.resolve(
				new Response(
					JSON.stringify({
						provider: "gemini",
						status: "loaded",
						fileName: "files/abc",
						fileUri: "gemini://files/abc",
						mimeType: "video/quicktime",
						displayName: "conclu.mov",
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				),
			);
		}) as unknown as typeof fetch;

		const tool = toolRegistry.get("load_context");
		const result = await tool.execute(
			{ targetType: "asset", assetId: "asset-video-octet" },
			makeContext({
				mediaAssets: [
					{
						id: "asset-video-octet",
						name: "conclu.mov",
						type: "video",
						duration: 30,
					},
				],
			}),
		);

		expect(uploaded.mimeType).toBe("video/quicktime");
		expect(result).toEqual(
			expect.objectContaining({
				context: expect.objectContaining({ mimeType: "video/quicktime" }),
			}),
		);
	});

	test("loads media context for timeline elements with assetId", async () => {
		const file = new File(["fake"], "intro.mp4", { type: "video/mp4" });
		mockResolveAssetFile.mockReturnValue(file);
		mockGeminiUploadResponse();

		const tool = toolRegistry.get("load_context");
		const result = await tool.execute(
			{
				targetType: "timeline_element",
				trackId: "main-track",
				elementId: "clip-1",
			},
			makeContext({
				mediaAssets: [
					{
						id: "asset-video-2",
						name: "other.mp4",
						type: "video",
						duration: 20,
					},
				],
				timelineTracks: [
					{
						trackId: "main-track",
						type: "main",
						position: 0,
						visualLayer: 0,
						isVisualLayer: true,
						stacking: "main",
						elements: [
							{
								elementId: "clip-1",
								type: "video",
								assetId: "asset-video-2",
								start: 5,
								end: 15,
							},
						],
					},
				],
			}),
		);

		expect(result).toEqual(
			expect.objectContaining({
				targetType: "asset",
				id: "asset-video-2",
				context: expect.objectContaining({
					kind: "media",
					assetId: "asset-video-2",
					element: {
						trackId: "main-track",
						elementId: "clip-1",
						type: "video",
						start: 5,
						end: 15,
					},
				}),
			}),
		);
	});

	test("validates missing timeline identifiers", async () => {
		const tool = toolRegistry.get("load_context");
		const result = await tool.execute(
			{ targetType: "timeline_element", elementId: "caption-1" },
			makeContext(),
		);

		expect(result).toEqual({ error: "trackId and elementId are required" });
	});
});
