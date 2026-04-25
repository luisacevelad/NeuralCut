import type {
	AgentContext,
	AgentTimelineTrack,
	ToolDefinition,
} from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";

export type ListTimelineResult = {
	tracks: AgentTimelineTrack[];
};

const listTimelineTool: ToolDefinition = {
	name: "list_timeline",
	description:
		"Lists the active timeline as structured tracks and editable elements with layer metadata. Element start/end values are in seconds. position is timeline row order from top to bottom; visualLayer is render stacking where higher renders above lower, and audio tracks have null visualLayer.",
	parameters: [],
	execute: async (
		_args: Record<string, unknown>,
		context: AgentContext,
	): Promise<ListTimelineResult | { error: string }> => {
		if (!context.activeSceneId || !context.timelineTracks) {
			return { error: "No active timeline" };
		}

		return { tracks: context.timelineTracks };
	},
};

toolRegistry.register("list_timeline", listTimelineTool);
