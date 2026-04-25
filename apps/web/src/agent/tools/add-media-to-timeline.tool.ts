import { EditorContextAdapter } from "@/agent/context";
import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { addMediaToTimelineSchema } from "@/agent/tools/schemas";

type AddMediaTrackType = "main" | "overlay" | "audio";

export type AddMediaToTimelineArgs = {
	assetId: string;
	startTime: number;
	trackType: AddMediaTrackType;
	duration?: number;
};

export type AddMediaToTimelineResult = {
	elementId: string;
	trackId: string;
};

const addMediaToTimelineTool: ToolDefinition = {
	...addMediaToTimelineSchema,
	execute: async (
		args: Record<string, unknown>,
		_context: AgentContext,
	): Promise<AddMediaToTimelineResult | { error: string }> => {
		const { assetId, startTime, trackType, duration } = args;

		if (!isValidAssetId(assetId)) {
			return { error: "Asset not found" };
		}
		if (!isValidStartTime(startTime)) {
			return { error: "Invalid start time" };
		}
		if (!isValidTrackType(trackType)) {
			return { error: "Invalid track type for asset" };
		}
		if (!isValidOptionalDuration(duration)) {
			return { error: "Invalid duration" };
		}

		return EditorContextAdapter.addMediaToTimeline({
			assetId,
			startTime,
			trackType,
			...(duration !== undefined && { duration }),
		});
	},
};

function isValidAssetId(assetId: unknown): assetId is string {
	return typeof assetId === "string" && assetId.trim().length > 0;
}

function isValidStartTime(startTime: unknown): startTime is number {
	return (
		typeof startTime === "number" &&
		Number.isFinite(startTime) &&
		startTime >= 0
	);
}

function isValidTrackType(trackType: unknown): trackType is AddMediaTrackType {
	return (
		trackType === "main" || trackType === "overlay" || trackType === "audio"
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

toolRegistry.register(addMediaToTimelineSchema.name, addMediaToTimelineTool);
