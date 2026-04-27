import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { listAnimatablePropertiesSchema } from "@/agent/tools/schemas";
import { EditorContextAdapter } from "@/agent/context";

const listAnimatablePropertiesTool: ToolDefinition = {
	...listAnimatablePropertiesSchema,
	execute: async (args: Record<string, unknown>, _context: AgentContext) => {
		const elementId = args.elementId;

		if (typeof elementId !== "string" || !elementId.trim()) {
			return { error: "Invalid elementId" };
		}

		return EditorContextAdapter.listAnimatableProperties({ elementId });
	},
};

toolRegistry.register(
	listAnimatablePropertiesSchema.name,
	listAnimatablePropertiesTool,
);
