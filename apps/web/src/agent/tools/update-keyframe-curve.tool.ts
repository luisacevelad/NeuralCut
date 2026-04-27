import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { updateKeyframeCurveSchema } from "@/agent/tools/schemas";
import { EditorContextAdapter } from "@/agent/context";

const updateKeyframeCurveTool: ToolDefinition = {
	...updateKeyframeCurveSchema,
	execute: async (args: Record<string, unknown>, _context: AgentContext) => {
		const elementId = args.elementId as string;
		const propertyPath = args.propertyPath as string;
		const keyframeId = args.keyframeId as string;
		const interpolation = args.interpolation as string | undefined;
		const rightHandle = args.rightHandle as
			| { dt: number; dv: number }
			| undefined;
		const leftHandle = args.leftHandle as
			| { dt: number; dv: number }
			| undefined;
		const tangentMode = args.tangentMode as string | undefined;

		if (typeof elementId !== "string" || !elementId.trim()) {
			return { error: "Invalid elementId" };
		}

		if (typeof propertyPath !== "string" || !propertyPath.trim()) {
			return { error: "Invalid propertyPath" };
		}

		if (typeof keyframeId !== "string" || !keyframeId.trim()) {
			return { error: "Invalid keyframeId" };
		}

		if (
			interpolation !== undefined &&
			!["linear", "bezier", "step"].includes(interpolation)
		) {
			return {
				error: "interpolation must be 'linear', 'bezier', or 'step'",
			};
		}

		if (rightHandle !== undefined) {
			if (
				typeof rightHandle !== "object" ||
				typeof rightHandle.dt !== "number" ||
				typeof rightHandle.dv !== "number"
			) {
				return {
					error: "rightHandle must be an object with numeric dt and dv",
				};
			}
		}

		if (leftHandle !== undefined) {
			if (
				typeof leftHandle !== "object" ||
				typeof leftHandle.dt !== "number" ||
				typeof leftHandle.dv !== "number"
			) {
				return {
					error: "leftHandle must be an object with numeric dt and dv",
				};
			}
		}

		return EditorContextAdapter.updateKeyframeCurve({
			elementId,
			propertyPath,
			keyframeId,
			interpolation,
			rightHandle,
			leftHandle,
			tangentMode,
		});
	},
};

toolRegistry.register(updateKeyframeCurveSchema.name, updateKeyframeCurveTool);
