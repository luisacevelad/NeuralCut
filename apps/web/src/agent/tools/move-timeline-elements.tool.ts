import { EditorContextAdapter } from "@/agent/context";
import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { resolveTargetsToElementIds } from "@/agent/tools/resolve-element-ids";
import { resolveTrack } from "@/agent/ref-resolver";
import { moveTimelineElementsSchema } from "@/agent/tools/schemas";

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
		context: AgentContext,
	): Promise<MoveTimelineElementsResult | { error: string }> => {
		const { start } = args;
		const raw = args.targets ?? args.elementIds;
		const resolved = resolveTargetsToElementIds(raw, context);
		if ("error" in resolved) return resolved;

		if (!isValidStart(start)) {
			return { error: "Invalid start time" };
		}

		let targetTrackId: string | undefined;
		const rawTrack = args.targetTrackRef ?? args.targetTrackId;
		if (rawTrack !== undefined) {
			const trackResult = resolveTrack(rawTrack as string, context);
			if ("error" in trackResult) return trackResult;
			targetTrackId = trackResult.trackId;
		}

		return EditorContextAdapter.moveTimelineElements({
			elementIds: resolved.elementIds,
			start,
			...(targetTrackId !== undefined && { targetTrackId }),
		});
	},
};

function isValidStart(start: unknown): start is number {
	return typeof start === "number" && Number.isFinite(start) && start >= 0;
}

toolRegistry.register(
	moveTimelineElementsSchema.name,
	moveTimelineElementsTool,
);
