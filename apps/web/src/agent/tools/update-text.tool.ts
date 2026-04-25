import { EditorContextAdapter } from "@/agent/context";
import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { resolveElementIds } from "@/agent/tools/resolve-element-ids";
import { updateTextSchema } from "@/agent/tools/schemas";

export type UpdateTextArgs = {
	elementIds: string[];
	content?: string;
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

export type UpdatedTextElement = {
	elementId: string;
	trackId: string;
};

export type UpdateTextResult = {
	success: boolean;
	updated: UpdatedTextElement[];
	skipped: string[];
};

const VALID_FONT_WEIGHTS = new Set(["normal", "bold"]);
const VALID_FONT_STYLES = new Set(["normal", "italic"]);
const VALID_TEXT_ALIGNS = new Set(["left", "center", "right"]);

const updateTextTool: ToolDefinition = {
	...updateTextSchema,
	execute: async (
		args: Record<string, unknown>,
		_context: AgentContext,
	): Promise<UpdateTextResult | { error: string }> => {
		const { elementIds, content, background } = args;

		const resolvedIds = resolveElementIds(elementIds);
		if (resolvedIds === null) {
			return {
				error:
					'elementIds must be a non-empty JSON array of strings, e.g. ["id1","id2"]',
			};
		}

		if (
			content !== undefined &&
			!(typeof content === "string" && content.trim().length > 0)
		) {
			return { error: "content must be a non-empty string" };
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
		if (background !== undefined && typeof background !== "object") {
			return { error: "Invalid background" };
		}

		const overrides: Omit<UpdateTextArgs, "elementIds"> = {};
		if (content !== undefined) overrides.content = content as string;
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
		if (background !== undefined)
			overrides.background = background as UpdateTextArgs["background"];

		return EditorContextAdapter.updateText({
			elementIds: resolvedIds,
			...overrides,
		});
	},
};

toolRegistry.register(updateTextSchema.name, updateTextTool);
