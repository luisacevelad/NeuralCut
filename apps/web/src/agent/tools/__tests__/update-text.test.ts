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
			{ elementId: "el-1", trackId: "track-1" },
			{ elementId: "el-2", trackId: "track-1" },
		],
		skipped: [],
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
	mediaAssets: [],
	playbackTimeMs: 0,
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
				{ elementId: "el-1", trackId: "track-1" },
				{ elementId: "el-2", trackId: "track-1" },
			],
			skipped: [],
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
				'elementIds must be a non-empty JSON array of strings, e.g. ["id1","id2"]',
		});
		expect(await tool.execute({ elementIds: [] }, context)).toEqual({
			error:
				'elementIds must be a non-empty JSON array of strings, e.g. ["id1","id2"]',
		});
		expect(
			await tool.execute({ elementIds: ["", "  "] }, context),
		).toEqual({
			error:
				'elementIds must be a non-empty JSON array of strings, e.g. ["id1","id2"]',
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
		).toEqual({ error: "Invalid fontSize" });

		expect(
			await tool.execute(
				{ elementIds: ["el-1"], background: "yes" },
				context,
			),
		).toEqual({ error: "Invalid background" });

		expect(mockUpdateText).not.toHaveBeenCalled();
	});
});
