import { EditorContextAdapter } from "@/agent/context";
import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { resolveElementIds } from "@/agent/tools/resolve-element-ids";
import { deleteTimelineElementsSchema } from "@/agent/tools/schemas";

export type DeleteTimelineElementsArgs = {
	elementIds: string[];
};

export type DeleteTimelineElementsResult = {
	success: boolean;
	deletedElements: string[];
};

const deleteTimelineElementsTool: ToolDefinition = {
	...deleteTimelineElementsSchema,
	execute: async (
		args: Record<string, unknown>,
		_context: AgentContext,
	): Promise<DeleteTimelineElementsResult | { error: string }> => {
		const elementIds = resolveElementIds(args.elementIds);

		if (!elementIds) {
			return {
				error:
					'elementIds must be a non-empty JSON array of strings, e.g. ["id1","id2"]',
			};
		}

		return EditorContextAdapter.deleteTimelineElements({ elementIds });
	},
};

toolRegistry.register(
	deleteTimelineElementsSchema.name,
	deleteTimelineElementsTool,
);
