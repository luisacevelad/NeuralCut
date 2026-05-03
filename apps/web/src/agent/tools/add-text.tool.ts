import { EditorContextAdapter } from "@/agent/context";
import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { addTextSchema } from "@/agent/tools/schemas";
import {
	validateFontSize,
	validateWordCount,
} from "@/agent/tools/text-constraints";

type TextPosition = "top" | "center" | "bottom";

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
	scaleX?: number;
	scaleY?: number;
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
	position?: TextPosition;
} & TextStyleOverrides;

export type AddTextResult = {
	elementId: string;
	trackId: string;
};

const VALID_FONT_WEIGHTS = new Set(["normal", "bold"]);
const VALID_FONT_STYLES = new Set(["normal", "italic"]);
const VALID_TEXT_ALIGNS = new Set(["left", "center", "right"]);

function isValidText(text: unknown): text is string {
	return typeof text === "string" && text.trim().length > 0;
}

function isValidTime(time: unknown): time is number {
	return typeof time === "number" && Number.isFinite(time) && time >= 0;
}

function isValidPosition(position: unknown): position is TextPosition {
	return position === "top" || position === "center" || position === "bottom";
}

function validateAndBuildOverrides(
	args: Record<string, unknown>,
): TextStyleOverrides | { error: string } {
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
		if (args.scaleX !== undefined && typeof args.scaleX !== "number") {
			return { error: "Invalid scaleX" };
		}
		if (args.scaleY !== undefined && typeof args.scaleY !== "number") {
			return { error: "Invalid scaleY" };
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
	if (args.scaleX !== undefined) overrides.scaleX = args.scaleX as number;
	if (args.scaleY !== undefined) overrides.scaleY = args.scaleY as number;
	if (args.background !== undefined) {
		overrides.background =
			args.background as TextStyleOverrides["background"];
	} else {
		overrides.background = { enabled: false };
	}

	return overrides;
}

function validateTextItem(
	item: Record<string, unknown>,
	resolution: { width: number; height: number } | null,
): AddTextArgs | { error: string } {
	const { text, start, end, position } = item;

	if (!isValidText(text)) {
		return { error: "Text is required" };
	}
	if (!isValidTime(start) || !isValidTime(end) || start >= end) {
		return { error: "Invalid time range" };
	}
	if (position !== undefined && !isValidPosition(position)) {
		return { error: "Invalid text position" };
	}

	// Global fontSize range enforcement (6–15, no clamping)
	const fontSizeError = validateFontSize(
		item.fontSize as number | undefined,
	);
	if (fontSizeError) return fontSizeError;

	// Global word-count enforcement based on orientation
	const wordCountError = validateWordCount(text as string, resolution);
	if (wordCountError) return wordCountError;

	const result = validateAndBuildOverrides(item);
	if ("error" in result) return result;

	return {
		text,
		start,
		end,
		...(isValidPosition(position) && { position }),
		...result,
	};
}

const addTextTool: ToolDefinition = {
	...addTextSchema,
	execute: async (
		args: Record<string, unknown>,
		_context: AgentContext,
	): Promise<AddTextResult | AddTextResult[] | { error: string }> => {
		if (Array.isArray(args.texts)) {
			const results: AddTextResult[] = [];
			for (const item of args.texts) {
				if (typeof item !== "object" || item === null) {
					return { error: "Each item in texts must be an object" };
				}
				const validated = validateTextItem(
					item as Record<string, unknown>,
					_context.resolution,
				);
				if ("error" in validated) return validated;
				const result = EditorContextAdapter.addText(validated);
				if ("error" in result) return result;
				results.push(result);
			}
			return results;
		}

		const validated = validateTextItem(args, _context.resolution);
		if ("error" in validated) return validated;
		return EditorContextAdapter.addText(validated);
	},
};

toolRegistry.register(addTextSchema.name, addTextTool);
