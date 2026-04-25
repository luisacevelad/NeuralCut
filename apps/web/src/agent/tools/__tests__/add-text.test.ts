import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { AgentContext } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";

const mockAddText = mock(
	(_args: {
		text: string;
		start: number;
		end: number;
		position: string;
		style?: string;
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
		elementId: "text-1",
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
	mediaAssets: [],
	playbackTimeMs: 0,
};

describe("add_text tool", () => {
	beforeEach(() => {
		mockAddText.mockClear();
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
				style: "subtitle",
			},
			context,
		);

		expect(mockAddText).toHaveBeenCalledWith({
			text: "Hello",
			start: 1,
			end: 4,
			position: "bottom",
			style: "subtitle",
		});
		expect(result).toEqual({ elementId: "text-1", trackId: "text-track-1" });
	});

	test("omits style when not provided", async () => {
		const tool = toolRegistry.get("add_text");
		await tool.execute(
			{ text: "Hello", start: 1, end: 4, position: "center" },
			context,
		);

		expect(mockAddText).toHaveBeenCalledWith({
			text: "Hello",
			start: 1,
			end: 4,
			position: "center",
		});
	});

	test("passes style overrides to the adapter", async () => {
		const tool = toolRegistry.get("add_text");
		await tool.execute(
			{
				text: "Title",
				start: 0,
				end: 3,
				position: "center",
				style: "hook",
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
			style: "hook",
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
		expect(
			await tool.execute(
				{ text: "Hello", start: 0, end: 1, position: "center", style: "big" },
				context,
			),
		).toEqual({ error: "Invalid text style" });
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
});
