import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { AgentContext } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";

const mockUpdateText = mock(
	(_args: {
		elementIds: string[];
		content?: string;
		color?: string;
		fontSize?: number;
		fontFamily?: string;
		fontWeight?: string;
		fontStyle?: string;
		textAlign?: string;
		letterSpacing?: number;
		positionX?: number;
		positionY?: number;
		background?: {
			enabled: boolean;
			color?: string;
			cornerRadius?: number;
			padding?: number;
		};
	}) => ({
		success: true,
		updated: [
			{ elementId: "el-1", trackId: "track-1", state: { elementId: "el-1", type: "text" } },
			{ elementId: "el-2", trackId: "track-1", state: { elementId: "el-2", type: "text" } },
		],
		skipped: [],
		results: [
			{ target: "el-1", status: "updated", state: { elementId: "el-1", type: "text" } },
			{ target: "el-2", status: "updated", state: { elementId: "el-2", type: "text" } },
		],
	}),
);

mock.module("@/agent/context", () => ({
	EditorContextAdapter: {
		updateText: mockUpdateText,
	},
}));

await import("@/agent/tools/update-text.tool");

const context: AgentContext = {
	projectId: "proj-1",
	activeSceneId: "scene-A",
	fps: null,
	duration: null,
	resolution: null,
	aspectRatio: null,
	projectName: null,
	mediaAssets: [],
	playbackTimeMs: 0,
	timelineTracks: [
		{
			trackId: "track-1",
			trackRef: "track-1",
			trackLabel: "Track 1",
			type: "text",
			position: 0,
			visualLayer: 0,
			isVisualLayer: true,
			stacking: "main",
			elements: [
				{
					elementId: "el-1",
					ref: "el-1",
					displayName: "el-1",
					type: "text",
					start: 0,
					end: 5,
					duration: 5,
				},
				{
					elementId: "el-2",
					ref: "el-2",
					displayName: "el-2",
					type: "text",
					start: 0,
					end: 5,
					duration: 5,
				},
				{
					elementId: "el-3",
					ref: "el-3",
					displayName: "el-3",
					type: "text",
					start: 0,
					end: 5,
					duration: 5,
				},
			],
		},
	],
};

describe("update_text tool", () => {
	beforeEach(() => {
		mockUpdateText.mockClear();
	});

	test("is registered in the tool registry", () => {
		expect(toolRegistry.has("update_text")).toBe(true);
	});

	test("updates text elements through the editor adapter", async () => {
		const tool = toolRegistry.get("update_text");
		const result = await tool.execute(
			{
				elementIds: ["el-1", "el-2"],
				color: "#FFFFFF",
				fontSize: 10,
			},
			context,
		);

		expect(mockUpdateText).toHaveBeenCalledWith({
			elementIds: ["el-1", "el-2"],
			color: "#FFFFFF",
			fontSize: 10,
		});
		expect(result).toEqual({
			success: true,
			updated: [
				{ elementId: "el-1", trackId: "track-1", state: { elementId: "el-1", type: "text" } },
				{ elementId: "el-2", trackId: "track-1", state: { elementId: "el-2", type: "text" } },
			],
			skipped: [],
			results: [
				{ target: "el-1", status: "updated", state: { elementId: "el-1", type: "text" } },
				{ target: "el-2", status: "updated", state: { elementId: "el-2", type: "text" } },
			],
		});
	});

	test("passes all overrides to the adapter", async () => {
		const tool = toolRegistry.get("update_text");
		await tool.execute(
			{
				elementIds: ["el-1"],
				content: "New text",
				color: "#FF0000",
				fontSize: 8,
				fontFamily: "Arial",
				fontWeight: "bold",
				fontStyle: "italic",
				textAlign: "center",
				letterSpacing: 2,
				positionX: 5,
				positionY: -10,
				background: {
					enabled: true,
					color: "#000000",
					cornerRadius: 8,
					padding: 10,
				},
			},
			context,
		);

		expect(mockUpdateText).toHaveBeenCalledWith({
			elementIds: ["el-1"],
			content: "New text",
			color: "#FF0000",
			fontSize: 8,
			fontFamily: "Arial",
			fontWeight: "bold",
			fontStyle: "italic",
			textAlign: "center",
			letterSpacing: 2,
			positionX: 5,
			positionY: -10,
			background: {
				enabled: true,
				color: "#000000",
				cornerRadius: 8,
				padding: 10,
			},
		});
	});

	test("validates elementIds is required and non-empty", async () => {
		const tool = toolRegistry.get("update_text");

		expect(await tool.execute({}, context)).toEqual({
			error:
				"targets must be a non-empty array of element refs, displayNames, or elementIds.",
		});
		expect(await tool.execute({ elementIds: [] }, context)).toEqual({
			error:
				"targets must be a non-empty array of element refs, displayNames, or elementIds.",
		});
		expect(
			await tool.execute({ elementIds: ["", "  "] }, context),
		).toEqual({
			error:
				"targets must be a non-empty array of element refs, displayNames, or elementIds.",
		});
		expect(mockUpdateText).not.toHaveBeenCalled();
	});

	test("accepts comma-separated string as elementIds", async () => {
		const tool = toolRegistry.get("update_text");
		await tool.execute(
			{
				elementIds: "el-1,el-2, el-3",
				fontFamily: "Playfair Display",
			},
			context,
		);

		expect(mockUpdateText).toHaveBeenCalledWith({
			elementIds: ["el-1", "el-2", "el-3"],
			fontFamily: "Playfair Display",
		});
	});

	test("validates override types", async () => {
		const tool = toolRegistry.get("update_text");

		expect(
			await tool.execute(
				{ elementIds: ["el-1"], fontWeight: "heavy" },
				context,
			),
		).toEqual({ error: "Invalid fontWeight" });

		expect(
			await tool.execute(
				{ elementIds: ["el-1"], fontStyle: "oblique" },
				context,
			),
		).toEqual({ error: "Invalid fontStyle" });

		expect(
			await tool.execute(
				{ elementIds: ["el-1"], textAlign: "justify" },
				context,
			),
		).toEqual({ error: "Invalid textAlign" });

		expect(
			await tool.execute(
				{ elementIds: ["el-1"], fontSize: -5 },
				context,
			),
		).toEqual({ error: expect.stringContaining("fontSize must be between") });

		expect(
			await tool.execute(
				{ elementIds: ["el-1"], background: "yes" },
				context,
			),
		).toEqual({ error: "Invalid background" });

		expect(mockUpdateText).not.toHaveBeenCalled();
	});

	test("rejects fontSize below minimum (6)", async () => {
		const tool = toolRegistry.get("update_text");
		const result = await tool.execute(
			{ elementIds: ["el-1"], fontSize: 5 },
			context,
		);
		expect(result).toEqual({ error: expect.stringContaining("fontSize must be between") });
		expect(mockUpdateText).not.toHaveBeenCalled();
	});

	test("rejects fontSize above maximum (15)", async () => {
		const tool = toolRegistry.get("update_text");
		const result = await tool.execute(
			{ elementIds: ["el-1"], fontSize: 16 },
			context,
		);
		expect(result).toEqual({ error: expect.stringContaining("fontSize must be between") });
		expect(mockUpdateText).not.toHaveBeenCalled();
	});

	test("allows fontSize at exact boundaries", async () => {
		const tool = toolRegistry.get("update_text");
		await tool.execute({ elementIds: ["el-1"], fontSize: 6 }, context);
		await tool.execute({ elementIds: ["el-1"], fontSize: 15 }, context);
		expect(mockUpdateText).toHaveBeenCalledTimes(2);
	});

	test("allows decimal fontSize within range", async () => {
		const tool = toolRegistry.get("update_text");
		await tool.execute({ elementIds: ["el-1"], fontSize: 8.5 }, context);
		expect(mockUpdateText).toHaveBeenCalledTimes(1);
	});

	test("rejects content exceeding word count (vertical canvas)", async () => {
		const tool = toolRegistry.get("update_text");
		const verticalContext: AgentContext = {
			...context,
			resolution: { width: 1080, height: 1920 },
		};
		const result = await tool.execute(
			{ elementIds: ["el-1"], content: "one two three four" },
			verticalContext,
		);
		expect(result).toEqual({ error: expect.stringContaining("4 words") });
		expect(mockUpdateText).not.toHaveBeenCalled();
	});

	test("allows content at max word count (vertical canvas)", async () => {
		const tool = toolRegistry.get("update_text");
		const verticalContext: AgentContext = {
			...context,
			resolution: { width: 1080, height: 1920 },
		};
		await tool.execute(
			{ elementIds: ["el-1"], content: "one two three" },
			verticalContext,
		);
		expect(mockUpdateText).toHaveBeenCalledTimes(1);
	});

	test("rejects content exceeding word count (horizontal canvas)", async () => {
		const tool = toolRegistry.get("update_text");
		const horizontalContext: AgentContext = {
			...context,
			resolution: { width: 1920, height: 1080 },
		};
		const result = await tool.execute(
			{ elementIds: ["el-1"], content: "a b c d e f g" },
			horizontalContext,
		);
		expect(result).toEqual({ error: expect.stringContaining("7 words") });
		expect(mockUpdateText).not.toHaveBeenCalled();
	});

	test("uses safest fallback (3 words) when resolution is null", async () => {
		const tool = toolRegistry.get("update_text");
		const result = await tool.execute(
			{ elementIds: ["el-1"], content: "one two three four" },
			context, // resolution: null
		);
		expect(result).toEqual({ error: expect.stringContaining("unknown orientation") });
		expect(mockUpdateText).not.toHaveBeenCalled();
	});

	test("skips word count validation when content is not provided", async () => {
		const tool = toolRegistry.get("update_text");
		// Only updating style, no content change — word count not checked
		await tool.execute(
			{ elementIds: ["el-1"], color: "#FF0000", fontSize: 10 },
			context,
		);
		expect(mockUpdateText).toHaveBeenCalledTimes(1);
	});
});
