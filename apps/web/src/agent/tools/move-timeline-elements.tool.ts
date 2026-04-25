import { EditorContextAdapter } from "@/agent/context";
import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { resolveElementIds } from "@/agent/tools/resolve-element-ids";
import { moveTimelineElementsSchema } from "@/agent/tools/schemas";

export type MoveTimelineElementsArgs = {
	elementIds: string[];
	start: number;
	targetTrackId?: string;
};

export type MoveTimelineElementsResult = {
	success: boolean;
	movedElements: Array<{
		elementId: string;
		trackId: string;
		start: number;
		end: number;
	}>;
};

const moveTimelineElementsTool: ToolDefinition = {
	...moveTimelineElementsSchema,
	execute: async (
		args: Record<string, unknown>,
		_context: AgentContext,
	): Promise<MoveTimelineElementsResult | { error: string }> => {
		const { start, targetTrackId } = args;
		const elementIds = resolveElementIds(args.elementIds);

		if (!elementIds) {
			return {
				error:
					'elementIds must be a non-empty JSON array of strings, e.g. ["id1","id2"]',
			};
		}
		if (!isValidStart(start)) {
			return { error: "Invalid start time" };
		}
		if (!isValidOptionalTargetTrackId(targetTrackId)) {
			return { error: "Invalid target track id" };
		}

		return EditorContextAdapter.moveTimelineElements({
			elementIds,
			start,
			...(targetTrackId !== undefined && { targetTrackId }),
		});
	},
};

function isValidStart(start: unknown): start is number {
	return typeof start === "number" && Number.isFinite(start) && start >= 0;
}

function isValidOptionalTargetTrackId(
	targetTrackId: unknown,
): targetTrackId is string | undefined {
	return (
		targetTrackId === undefined ||
		(typeof targetTrackId === "string" && targetTrackId.trim().length > 0)
	);
}

toolRegistry.register(
	moveTimelineElementsSchema.name,
	moveTimelineElementsTool,
);
