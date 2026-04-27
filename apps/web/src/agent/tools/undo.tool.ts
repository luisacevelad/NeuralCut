import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { undoSchema } from "@/agent/tools/schemas";
import { EditorContextAdapter } from "@/agent/context";

const undoTool: ToolDefinition = {
	...undoSchema,
	execute: async (
		_args: Record<string, unknown>,
		_context: AgentContext,
	): Promise<{ remainingUndoDepth: number } | { error: string }> => {
		return EditorContextAdapter.undo();
	},
};

toolRegistry.register(undoSchema.name, undoTool);
