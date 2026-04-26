import { EditorContextAdapter } from "@/agent/context";
import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { resolveElementIds } from "@/agent/tools/resolve-element-ids";
import { duplicateElementsSchema } from "@/agent/tools/schemas";

const duplicateElementsTool: ToolDefinition = {
	...duplicateElementsSchema,
	execute: async (
		args: Record<string, unknown>,
		_context: AgentContext,
	): Promise<
		| {
				success: boolean;
				duplicated: Array<{ elementId: string; trackId: string }>;
		  }
		| { error: string }
	> => {
		const elementIds = resolveElementIds(args.elementIds);

		if (!elementIds) {
			return {
				error:
					'elementIds must be a non-empty JSON array of strings, e.g. ["id1","id2"]',
			};
		}

		return EditorContextAdapter.duplicateElements({ elementIds });
	},
};

toolRegistry.register(duplicateElementsSchema.name, duplicateElementsTool);
