import { EditorContextAdapter } from "@/agent/context";
import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { updateTimelineElementTimingSchema } from "@/agent/tools/schemas";

export type UpdateTimelineElementTimingArgs = {
	elementId: string;
	start?: number;
	end?: number;
	duration?: number;
};

export type UpdateTimelineElementTimingResult = {
	success: boolean;
	elementId: string;
	trackId: string;
	start: number;
	end: number;
	duration: number;
};

const updateTimelineElementTimingTool: ToolDefinition = {
	...updateTimelineElementTimingSchema,
	execute: async (
		args: Record<string, unknown>,
		_context: AgentContext,
	): Promise<UpdateTimelineElementTimingResult | { error: string }> => {
		const { elementId, start, end, duration } = args;

		if (!isValidElementId(elementId)) {
			return { error: "Invalid element id" };
		}
		if (start === undefined && end === undefined && duration === undefined) {
			return { error: "Invalid timing update" };
		}
		if (!isValidOptionalStart(start)) {
			return { error: "Invalid start time" };
		}
		if (!isValidOptionalEnd(end)) {
			return { error: "Invalid end time" };
		}
		if (!isValidOptionalDuration(duration)) {
			return { error: "Invalid duration" };
		}

		return EditorContextAdapter.updateTimelineElementTiming({
			elementId,
			...(start !== undefined && { start }),
			...(end !== undefined && { end }),
			...(duration !== undefined && { duration }),
		});
	},
};

function isValidElementId(elementId: unknown): elementId is string {
	return typeof elementId === "string" && elementId.trim().length > 0;
}

function isValidOptionalStart(start: unknown): start is number | undefined {
	return (
		start === undefined ||
		(typeof start === "number" && Number.isFinite(start) && start >= 0)
	);
}

function isValidOptionalEnd(end: unknown): end is number | undefined {
	return (
		end === undefined ||
		(typeof end === "number" && Number.isFinite(end) && end > 0)
	);
}

function isValidOptionalDuration(
	duration: unknown,
): duration is number | undefined {
	return (
		duration === undefined ||
		(typeof duration === "number" && Number.isFinite(duration) && duration > 0)
	);
}

toolRegistry.register(
	updateTimelineElementTimingSchema.name,
	updateTimelineElementTimingTool,
);
