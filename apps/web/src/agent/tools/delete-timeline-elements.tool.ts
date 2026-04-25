import { EditorContextAdapter } from "@/agent/context";
import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";

export type DeleteTimelineElementsArgs = {
	elementIds: string[];
};

export type DeleteTimelineElementsResult = {
	success: boolean;
	deletedElements: string[];
};

const deleteTimelineElementsTool: ToolDefinition = {
	name: "delete_timeline_elements",
	description:
		"Deletes one or more timeline elements by elementId. Use list_timeline first to discover exact elementIds. To delete a time range, split at the range boundaries first, then delete the isolated elementIds.",
	parameters: [{ key: "elementIds", type: "string[]", required: true }],
	execute: async (
		args: Record<string, unknown>,
		_context: AgentContext,
	): Promise<DeleteTimelineElementsResult | { error: string }> => {
		const elementIds = args.elementIds;

		if (!isValidElementIds(elementIds)) {
			return { error: "Invalid element ids" };
		}

		return EditorContextAdapter.deleteTimelineElements({ elementIds });
	},
};

function isValidElementIds(elementIds: unknown): elementIds is string[] {
	return (
		Array.isArray(elementIds) &&
		elementIds.length > 0 &&
		elementIds.every(
			(elementId) =>
				typeof elementId === "string" && elementId.trim().length > 0,
		)
	);
}

toolRegistry.register("delete_timeline_elements", deleteTimelineElementsTool);
