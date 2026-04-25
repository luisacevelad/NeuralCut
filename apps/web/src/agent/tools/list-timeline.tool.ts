import type {
	AgentContext,
	AgentTimelineTrack,
	ToolDefinition,
} from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { listTimelineSchema } from "@/agent/tools/schemas";

export type ListTimelineResult = {
	tracks: AgentTimelineTrack[];
};

const listTimelineTool: ToolDefinition = {
	...listTimelineSchema,
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

toolRegistry.register(listTimelineSchema.name, listTimelineTool);
