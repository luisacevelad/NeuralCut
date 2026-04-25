import { EditorContextAdapter } from "@/agent/context";
import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";

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
	name: "move_timeline_elements",
	description:
		"Moves one or more existing timeline elements to a new timeline start time in seconds. For multiple elements, the earliest selected element is moved to start and the others preserve their relative offsets. Optionally pass targetTrackId to move them to another compatible track.",
	parameters: [
		{ key: "elementIds", type: "string[]", required: true },
		{ key: "start", type: "number", required: true },
		{ key: "targetTrackId", type: "string", required: false },
	],
	execute: async (
		args: Record<string, unknown>,
		_context: AgentContext,
	): Promise<MoveTimelineElementsResult | { error: string }> => {
		const { elementIds, start, targetTrackId } = args;

		if (!isValidElementIds(elementIds)) {
			return { error: "Invalid element ids" };
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

toolRegistry.register("move_timeline_elements", moveTimelineElementsTool);
