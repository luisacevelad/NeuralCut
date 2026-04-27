import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { listKeyframesSchema } from "@/agent/tools/schemas";
import { EditorContextAdapter } from "@/agent/context";

const listKeyframesTool: ToolDefinition = {
	...listKeyframesSchema,
	execute: async (args: Record<string, unknown>, _context: AgentContext) => {
		const elementId = args.elementId;

		if (typeof elementId !== "string" || !elementId.trim()) {
			return { error: "Invalid elementId" };
		}

		return EditorContextAdapter.listKeyframes({ elementId });
	},
};

toolRegistry.register(listKeyframesSchema.name, listKeyframesTool);
