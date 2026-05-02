import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { AgentContext } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";

let callIndex = 0;
const mockAddText = mock(
	(_args: {
		text: string;
		start: number;
		end: number;
		position: string;
		color?: string;
		fontSize?: number;
		fontFamily?: string;
		fontWeight?: string;
		fontStyle?: string;
		textAlign?: string;
		letterSpacing?: number;
		positionX?: number;
		positionY?: number;
		background?: { enabled: boolean; color?: string; cornerRadius?: number; padding?: number };
	}) => ({
		elementId: `text-${++callIndex}`,
		trackId: "text-track-1",
	}),
);

mock.module("@/agent/context", () => ({
	EditorContextAdapter: {
		addText: mockAddText,
	},
}));

await import("@/agent/tools/add-text.tool");

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
};

describe("add_text tool", () => {
	beforeEach(() => {
		mockAddText.mockClear();
		callIndex = 0;
	});

	test("is registered in the tool registry", () => {
		expect(toolRegistry.has("add_text")).toBe(true);
	});

	test("adds text through the editor adapter", async () => {
		const tool = toolRegistry.get("add_text");
		const result = await tool.execute(
			{
				text: "Hello",
				start: 1,
				end: 4,
				position: "bottom",
			},
			context,
		);

		expect(mockAddText).toHaveBeenCalledWith({
			text: "Hello",
			start: 1,
			end: 4,
			position: "bottom",
		});
		expect(result).toEqual({ elementId: "text-1", trackId: "text-track-1" });
	});

	test("passes overrides to the adapter", async () => {
		const tool = toolRegistry.get("add_text");
		await tool.execute(
			{
				text: "Title",
				start: 0,
				end: 3,
				position: "center",
				color: "#FF0000",
				fontSize: 10,
				fontFamily: "Inter",
				fontWeight: "bold",
				fontStyle: "italic",
				textAlign: "center",
				letterSpacing: 2,
				positionX: 5,
				positionY: -10,
				background: { enabled: true, color: "#000000", cornerRadius: 8, padding: 10 },
			},
			context,
		);

		expect(mockAddText).toHaveBeenCalledWith({
			text: "Title",
			start: 0,
			end: 3,
			position: "center",
			color: "#FF0000",
			fontSize: 10,
			fontFamily: "Inter",
			fontWeight: "bold",
			fontStyle: "italic",
			textAlign: "center",
			letterSpacing: 2,
			positionX: 5,
			positionY: -10,
			background: { enabled: true, color: "#000000", cornerRadius: 8, padding: 10 },
		});
	});

	test("validates add text arguments", async () => {
		const tool = toolRegistry.get("add_text");

		expect(
			await tool.execute(
				{ text: "", start: 0, end: 1, position: "center" },
				context,
			),
		).toEqual({ error: "Text is required" });
		expect(
			await tool.execute(
				{ text: "Hello", start: 1, end: 1, position: "center" },
				context,
			),
		).toEqual({ error: "Invalid time range" });
		expect(
			await tool.execute(
				{ text: "Hello", start: 0, end: 1, position: "left" },
				context,
			),
		).toEqual({ error: "Invalid text position" });
		expect(mockAddText).not.toHaveBeenCalled();
	});

	test("validates override arguments", async () => {
		const tool = toolRegistry.get("add_text");

		expect(
			await tool.execute(
				{ text: "A", start: 0, end: 1, position: "center", fontWeight: "heavy" },
				context,
			),
		).toEqual({ error: "Invalid fontWeight" });

		expect(
			await tool.execute(
				{ text: "A", start: 0, end: 1, position: "center", fontStyle: "oblique" },
				context,
			),
		).toEqual({ error: "Invalid fontStyle" });

		expect(
			await tool.execute(
				{ text: "A", start: 0, end: 1, position: "center", textAlign: "justify" },
				context,
			),
		).toEqual({ error: "Invalid textAlign" });

		expect(
			await tool.execute(
				{ text: "A", start: 0, end: 1, position: "center", fontSize: -5 },
				context,
			),
		).toEqual({ error: "Invalid fontSize" });

		expect(
			await tool.execute(
				{ text: "A", start: 0, end: 1, position: "center", background: "yes" },
				context,
			),
		).toEqual({ error: "Invalid background" });

		expect(mockAddText).not.toHaveBeenCalled();
	});

	test("batch mode: adds multiple texts with a single call", async () => {
		const tool = toolRegistry.get("add_text");
		const result = await tool.execute(
			{
				texts: [
					{ text: "First", start: 0, end: 2, position: "top" },
					{ text: "Second", start: 2, end: 4, position: "bottom" },
					{ text: "Third", start: 4, end: 6, position: "center" },
				],
			},
			context,
		);

		expect(mockAddText).toHaveBeenCalledTimes(3);
		expect(mockAddText).toHaveBeenNthCalledWith(1, {
			text: "First",
			start: 0,
			end: 2,
			position: "top",
		});
		expect(mockAddText).toHaveBeenNthCalledWith(2, {
			text: "Second",
			start: 2,
			end: 4,
			position: "bottom",
		});
		expect(mockAddText).toHaveBeenNthCalledWith(3, {
			text: "Third",
			start: 4,
			end: 6,
			position: "center",
		});
		expect(result).toEqual([
			{ elementId: "text-1", trackId: "text-track-1" },
			{ elementId: "text-2", trackId: "text-track-1" },
			{ elementId: "text-3", trackId: "text-track-1" },
		]);
	});

	test("batch mode: each item can have different overrides", async () => {
		const tool = toolRegistry.get("add_text");
		await tool.execute(
			{
				texts: [
					{ text: "Red", start: 0, end: 1, position: "top", color: "#FF0000", fontSize: 10 },
					{ text: "Blue", start: 1, end: 2, position: "bottom", color: "#0000FF", fontWeight: "bold" },
				],
			},
			context,
		);

		expect(mockAddText).toHaveBeenNthCalledWith(1, {
			text: "Red",
			start: 0,
			end: 1,
			position: "top",
			color: "#FF0000",
			fontSize: 10,
		});
		expect(mockAddText).toHaveBeenNthCalledWith(2, {
			text: "Blue",
			start: 1,
			end: 2,
			position: "bottom",
			color: "#0000FF",
			fontWeight: "bold",
		});
	});

	test("batch mode: validates each item independently", async () => {
		const tool = toolRegistry.get("add_text");

		expect(
			await tool.execute(
				{
					texts: [
						{ text: "Valid", start: 0, end: 1, position: "center" },
						{ text: "", start: 1, end: 2, position: "center" },
					],
				},
				context,
			),
		).toEqual({ error: "Text is required" });

		expect(mockAddText).toHaveBeenCalledTimes(1);
	});

	test("batch mode: rejects non-object items", async () => {
		const tool = toolRegistry.get("add_text");

		expect(
			await tool.execute(
				{ texts: ["not an object" as unknown] },
				context,
			),
		).toEqual({ error: "Each item in texts must be an object" });
		expect(mockAddText).not.toHaveBeenCalled();
	});
});
