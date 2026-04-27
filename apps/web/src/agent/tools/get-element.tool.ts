import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { getElementSchema } from "@/agent/tools/schemas";
import { EditorContextAdapter } from "@/agent/context";

const getElementTool: ToolDefinition = {
	...getElementSchema,
	execute: async (
		args: Record<string, unknown>,
		_context: AgentContext,
	): Promise<Record<string, unknown> | { error: string }> => {
		const elementId = args.elementId;

		if (typeof elementId !== "string" || !elementId.trim()) {
			return { error: "Invalid elementId" };
		}

		return EditorContextAdapter.getElement({ elementId });
	},
};

toolRegistry.register(getElementSchema.name, getElementTool);
