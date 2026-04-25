import { EditorContextAdapter } from "@/agent/context";
import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { addTextSchema } from "@/agent/tools/schemas";

type TextPosition = "top" | "center" | "bottom";
type TextStyle = "plain" | "subtitle" | "hook" | "label";

export type TextStyleOverrides = {
	color?: string;
	fontSize?: number;
	fontFamily?: string;
	fontWeight?: "normal" | "bold";
	fontStyle?: "normal" | "italic";
	textAlign?: "left" | "center" | "right";
	letterSpacing?: number;
	positionX?: number;
	positionY?: number;
	background?: {
		enabled: boolean;
		color?: string;
		cornerRadius?: number;
		padding?: number;
	};
};

export type AddTextArgs = {
	text: string;
	start: number;
	end: number;
	position: TextPosition;
	style?: TextStyle;
} & TextStyleOverrides;

export type AddTextResult = {
	elementId: string;
	trackId: string;
};

const VALID_FONT_WEIGHTS = new Set(["normal", "bold"]);
const VALID_FONT_STYLES = new Set(["normal", "italic"]);
const VALID_TEXT_ALIGNS = new Set(["left", "center", "right"]);

const addTextTool: ToolDefinition = {
	...addTextSchema,
	execute: async (
		args: Record<string, unknown>,
		_context: AgentContext,
	): Promise<AddTextResult | { error: string }> => {
		const { text, start, end, position, style } = args;

		if (!isValidText(text)) {
			return { error: "Text is required" };
		}
		if (!isValidTime(start) || !isValidTime(end) || start >= end) {
			return { error: "Invalid time range" };
		}
		if (!isValidPosition(position)) {
			return { error: "Invalid text position" };
		}
		if (!isValidOptionalStyle(style)) {
			return { error: "Invalid text style" };
		}
		if (
			args.fontWeight !== undefined &&
			!VALID_FONT_WEIGHTS.has(args.fontWeight as string)
		) {
			return { error: "Invalid fontWeight" };
		}
		if (
			args.fontStyle !== undefined &&
			!VALID_FONT_STYLES.has(args.fontStyle as string)
		) {
			return { error: "Invalid fontStyle" };
		}
		if (
			args.textAlign !== undefined &&
			!VALID_TEXT_ALIGNS.has(args.textAlign as string)
		) {
			return { error: "Invalid textAlign" };
		}
		if (
			args.fontSize !== undefined &&
			(typeof args.fontSize !== "number" || args.fontSize <= 0)
		) {
			return { error: "Invalid fontSize" };
		}
		if (
			args.letterSpacing !== undefined &&
			typeof args.letterSpacing !== "number"
		) {
			return { error: "Invalid letterSpacing" };
		}
		if (args.positionX !== undefined && typeof args.positionX !== "number") {
			return { error: "Invalid positionX" };
		}
		if (args.positionY !== undefined && typeof args.positionY !== "number") {
			return { error: "Invalid positionY" };
		}
		if (args.background !== undefined && typeof args.background !== "object") {
			return { error: "Invalid background" };
		}

		const overrides: TextStyleOverrides = {};
		if (args.color !== undefined) overrides.color = args.color as string;
		if (args.fontSize !== undefined)
			overrides.fontSize = args.fontSize as number;
		if (args.fontFamily !== undefined)
			overrides.fontFamily = args.fontFamily as string;
		if (args.fontWeight !== undefined)
			overrides.fontWeight = args.fontWeight as "normal" | "bold";
		if (args.fontStyle !== undefined)
			overrides.fontStyle = args.fontStyle as "normal" | "italic";
		if (args.textAlign !== undefined)
			overrides.textAlign = args.textAlign as "left" | "center" | "right";
		if (args.letterSpacing !== undefined)
			overrides.letterSpacing = args.letterSpacing as number;
		if (args.positionX !== undefined)
			overrides.positionX = args.positionX as number;
		if (args.positionY !== undefined)
			overrides.positionY = args.positionY as number;
		if (args.background !== undefined)
			overrides.background =
				args.background as TextStyleOverrides["background"];

		return EditorContextAdapter.addText({
			text,
			start,
			end,
			position,
			...(style !== undefined && { style }),
			...overrides,
		});
	},
};

function isValidText(text: unknown): text is string {
	return typeof text === "string" && text.trim().length > 0;
}

function isValidTime(time: unknown): time is number {
	return typeof time === "number" && Number.isFinite(time) && time >= 0;
}

function isValidPosition(position: unknown): position is TextPosition {
	return position === "top" || position === "center" || position === "bottom";
}

function isValidOptionalStyle(style: unknown): style is TextStyle | undefined {
	return (
		style === undefined ||
		style === "plain" ||
		style === "subtitle" ||
		style === "hook" ||
		style === "label"
	);
}

toolRegistry.register(addTextSchema.name, addTextTool);
