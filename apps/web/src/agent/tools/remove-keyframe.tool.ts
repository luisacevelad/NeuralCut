import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { removeKeyframeSchema } from "@/agent/tools/schemas";
import { EditorContextAdapter } from "@/agent/context";

const removeKeyframeTool: ToolDefinition = {
	...removeKeyframeSchema,
	execute: async (args: Record<string, unknown>, _context: AgentContext) => {
		const elementId = args.elementId as string;
		const propertyPath = args.propertyPath as string;
		const keyframeId = args.keyframeId as string;

		if (typeof elementId !== "string" || !elementId.trim()) {
			return { error: "Invalid elementId" };
		}

		if (typeof propertyPath !== "string" || !propertyPath.trim()) {
			return { error: "Invalid propertyPath" };
		}

		if (typeof keyframeId !== "string" || !keyframeId.trim()) {
			return { error: "Invalid keyframeId" };
		}

		return EditorContextAdapter.removeKeyframe({
			elementId,
			propertyPath,
			keyframeId,
		});
	},
};

toolRegistry.register(removeKeyframeSchema.name, removeKeyframeTool);
