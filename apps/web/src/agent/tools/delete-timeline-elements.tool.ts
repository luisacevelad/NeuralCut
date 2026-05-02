import { EditorContextAdapter } from "@/agent/context";
import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { resolveTargetsToElementIds } from "@/agent/tools/resolve-element-ids";
import { deleteTimelineElementsSchema } from "@/agent/tools/schemas";

export type DeleteTimelineElementsResult = {
	success: boolean;
	deletedElements: string[];
};

const deleteTimelineElementsTool: ToolDefinition = {
	...deleteTimelineElementsSchema,
	execute: async (
		args: Record<string, unknown>,
		context: AgentContext,
	): Promise<DeleteTimelineElementsResult | { error: string }> => {
		const raw = args.targets ?? args.elementIds;
		const resolved = resolveTargetsToElementIds(raw, context);
		if ("error" in resolved) return resolved;

		return EditorContextAdapter.deleteTimelineElements({ elementIds: resolved.elementIds });
	},
};

toolRegistry.register(
	deleteTimelineElementsSchema.name,
	deleteTimelineElementsTool,
);
