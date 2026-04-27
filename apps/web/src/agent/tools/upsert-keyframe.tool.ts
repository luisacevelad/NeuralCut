import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { upsertKeyframeSchema } from "@/agent/tools/schemas";
import { EditorContextAdapter } from "@/agent/context";
import type { AnimationInterpolation } from "@/lib/animation/types";

const COLOR_PROPERTY_PATHS = new Set(["color", "background.color"]);

const upsertKeyframeTool: ToolDefinition = {
	...upsertKeyframeSchema,
	execute: async (args: Record<string, unknown>, _context: AgentContext) => {
		const elementId = args.elementId as string;
		const propertyPath = args.propertyPath as string;
		const time = args.time as number;
		const value = args.value as number | undefined;
		const colorValue = args.colorValue as string | undefined;
		const interpolation = args.interpolation as
			| AnimationInterpolation
			| undefined;
		const keyframeId = args.keyframeId as string | undefined;

		if (typeof elementId !== "string" || !elementId.trim()) {
			return { error: "Invalid elementId" };
		}

		if (typeof propertyPath !== "string" || !propertyPath.trim()) {
			return { error: "Invalid propertyPath" };
		}

		if (typeof time !== "number" || time < 0) {
			return { error: "time must be a non-negative number (seconds)" };
		}

		const isColorProperty = COLOR_PROPERTY_PATHS.has(propertyPath);

		if (isColorProperty) {
			if (!colorValue || typeof colorValue !== "string") {
				return {
					error:
						"colorValue is required for color properties (hex string like '#ff0000')",
				};
			}
			return EditorContextAdapter.upsertColorKeyframe({
				elementId,
				propertyPath,
				time,
				colorValue,
				interpolation,
				keyframeId,
			});
		}

		if (value === undefined || typeof value !== "number") {
			return {
				error: "value is required and must be a number for numeric properties",
			};
		}

		return EditorContextAdapter.upsertKeyframe({
			elementId,
			propertyPath,
			time,
			value,
			interpolation,
			keyframeId,
		});
	},
};

toolRegistry.register(upsertKeyframeSchema.name, upsertKeyframeTool);
