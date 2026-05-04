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
			background: { enabled: false },
		});
		expect(result).toEqual({ elementId: "text-1", trackId: "text-track-1" });
	});

	test("defaults background to disabled when not provided", async () => {
		const tool = toolRegistry.get("add_text");
		await tool.execute(
			{ text: "No bg", start: 0, end: 2 },
			context,
		);

		expect(mockAddText).toHaveBeenCalledWith(
			expect.objectContaining({
				background: { enabled: false },
			}),
		);
	});

	test("preserves explicit background when provided", async () => {
		const tool = toolRegistry.get("add_text");
		await tool.execute(
			{
				text: "With bg",
				start: 0,
				end: 2,
				background: { enabled: true, color: "#000000", cornerRadius: 4, padding: 8 },
			},
			context,
		);

		expect(mockAddText).toHaveBeenCalledWith(
			expect.objectContaining({
				background: { enabled: true, color: "#000000", cornerRadius: 4, padding: 8 },
			}),
		);
	});

	test("allows explicit background disabled", async () => {
		const tool = toolRegistry.get("add_text");
		await tool.execute(
			{
				text: "Explicit off",
				start: 0,
				end: 2,
				background: { enabled: false },
			},
			context,
		);

		expect(mockAddText).toHaveBeenCalledWith(
			expect.objectContaining({
				background: { enabled: false },
			}),
		);
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
		).toEqual({ error: expect.stringContaining("fontSize must be between") });

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
			background: { enabled: false },
		});
		expect(mockAddText).toHaveBeenNthCalledWith(2, {
			text: "Second",
			start: 2,
			end: 4,
			position: "bottom",
			background: { enabled: false },
		});
		expect(mockAddText).toHaveBeenNthCalledWith(3, {
			text: "Third",
			start: 4,
			end: 6,
			position: "center",
			background: { enabled: false },
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
			background: { enabled: false },
		});
		expect(mockAddText).toHaveBeenNthCalledWith(2, {
			text: "Blue",
			start: 1,
			end: 2,
			position: "bottom",
			color: "#0000FF",
			fontWeight: "bold",
			background: { enabled: false },
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

		// Atomic batch: earlier items must NOT be added when a later one fails.
		expect(mockAddText).toHaveBeenCalledTimes(0);
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

	test("rejects fontSize below minimum (6)", async () => {
		const tool = toolRegistry.get("add_text");
		const result = await tool.execute(
			{ text: "Hi", start: 0, end: 1, fontSize: 5 },
			context,
		);
		expect(result).toEqual({ error: expect.stringContaining("fontSize must be between") });
		expect(mockAddText).not.toHaveBeenCalled();
	});

	test("rejects fontSize above maximum (15)", async () => {
		const tool = toolRegistry.get("add_text");
		const result = await tool.execute(
			{ text: "Hi", start: 0, end: 1, fontSize: 16 },
			context,
		);
		expect(result).toEqual({ error: expect.stringContaining("fontSize must be between") });
		expect(mockAddText).not.toHaveBeenCalled();
	});

	test("allows fontSize at exact boundaries (6 and 15)", async () => {
		const tool = toolRegistry.get("add_text");
		await tool.execute({ text: "A", start: 0, end: 1, fontSize: 6 }, context);
		await tool.execute({ text: "B", start: 0, end: 1, fontSize: 15 }, context);
		expect(mockAddText).toHaveBeenCalledTimes(2);
	});

	test("allows decimal fontSize within range", async () => {
		const tool = toolRegistry.get("add_text");
		await tool.execute({ text: "A", start: 0, end: 1, fontSize: 6.5 }, context);
		expect(mockAddText).toHaveBeenCalledTimes(1);
	});

	test("rejects text exceeding word count (vertical canvas)", async () => {
		const tool = toolRegistry.get("add_text");
		const verticalContext: AgentContext = {
			...context,
			resolution: { width: 1080, height: 1920 },
		};
		const result = await tool.execute(
			{ text: "one two three four", start: 0, end: 1 },
			verticalContext,
		);
		expect(result).toEqual({ error: expect.stringContaining("4 words") });
		expect(mockAddText).not.toHaveBeenCalled();
	});

	test("allows text at max word count (vertical canvas)", async () => {
		const tool = toolRegistry.get("add_text");
		const verticalContext: AgentContext = {
			...context,
			resolution: { width: 1080, height: 1920 },
		};
		await tool.execute(
			{ text: "one two three", start: 0, end: 1 },
			verticalContext,
		);
		expect(mockAddText).toHaveBeenCalledTimes(1);
	});

	test("rejects text exceeding word count (horizontal canvas)", async () => {
		const tool = toolRegistry.get("add_text");
		const horizontalContext: AgentContext = {
			...context,
			resolution: { width: 1920, height: 1080 },
		};
		const result = await tool.execute(
			{ text: "a b c d e f g", start: 0, end: 1 },
			horizontalContext,
		);
		expect(result).toEqual({ error: expect.stringContaining("7 words") });
		expect(mockAddText).not.toHaveBeenCalled();
	});

	test("uses safest fallback (3 words) when resolution is null", async () => {
		const tool = toolRegistry.get("add_text");
		const result = await tool.execute(
			{ text: "one two three four", start: 0, end: 1 },
			context, // resolution: null
		);
		expect(result).toEqual({ error: expect.stringContaining("unknown orientation") });
		expect(mockAddText).not.toHaveBeenCalled();
	});

	test("batch mode: validates word count per item", async () => {
		const tool = toolRegistry.get("add_text");
		const verticalContext: AgentContext = {
			...context,
			resolution: { width: 1080, height: 1920 },
		};
		const result = await tool.execute(
			{
				texts: [
					{ text: "ok", start: 0, end: 1 },
					{ text: "one two three four five", start: 1, end: 2 },
				],
			},
			verticalContext,
		);
		expect(result).toEqual({ error: expect.stringContaining("5 words") });
	});

	test("batch mode: validates fontSize per item", async () => {
		const tool = toolRegistry.get("add_text");
		const result = await tool.execute(
			{
				texts: [
					{ text: "ok", start: 0, end: 1, fontSize: 10 },
					{ text: "bad", start: 1, end: 2, fontSize: 20 },
				],
			},
			context,
		);
		expect(result).toEqual({ error: expect.stringContaining("fontSize must be between") });
	});

	test("batch mode: failing later item does NOT add earlier items (atomicity)", async () => {
		const tool = toolRegistry.get("add_text");
		const verticalContext: AgentContext = {
			...context,
			resolution: { width: 1080, height: 1920 },
		};

		// 3 valid captions followed by 1 that exceeds word count
		const result = await tool.execute(
			{
				texts: [
					{ text: "one", start: 0, end: 1 },
					{ text: "two", start: 1, end: 2 },
					{ text: "three", start: 2, end: 3 },
					{ text: "one two three four five", start: 3, end: 4 },
				],
			},
			verticalContext,
		);

		expect(result).toEqual({ error: expect.stringContaining("5 words") });
		// Regression: NO items should be added when any item in the batch fails.
		expect(mockAddText).toHaveBeenCalledTimes(0);
	});

	test("batch mode: valid batch adds all items after full validation passes", async () => {
		const tool = toolRegistry.get("add_text");
		const verticalContext: AgentContext = {
			...context,
			resolution: { width: 1080, height: 1920 },
		};

		const result = await tool.execute(
			{
				texts: [
					{ text: "one", start: 0, end: 1 },
					{ text: "two", start: 1, end: 2 },
					{ text: "three", start: 2, end: 3 },
				],
			},
			verticalContext,
		);

		expect(mockAddText).toHaveBeenCalledTimes(3);
		expect(result).toEqual([
			{ elementId: "text-1", trackId: "text-track-1" },
			{ elementId: "text-2", trackId: "text-track-1" },
			{ elementId: "text-3", trackId: "text-track-1" },
		]);
	});
});
