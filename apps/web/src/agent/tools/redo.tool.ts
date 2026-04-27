import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { redoSchema } from "@/agent/tools/schemas";
import { EditorContextAdapter } from "@/agent/context";

const redoTool: ToolDefinition = {
	...redoSchema,
	execute: async (
		_args: Record<string, unknown>,
		_context: AgentContext,
	): Promise<{ remainingRedoDepth: number } | { error: string }> => {
		return EditorContextAdapter.redo();
	},
};

toolRegistry.register(redoSchema.name, redoTool);
