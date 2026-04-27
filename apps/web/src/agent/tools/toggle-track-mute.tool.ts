import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { toggleTrackMuteSchema } from "@/agent/tools/schemas";
import { EditorContextAdapter } from "@/agent/context";

const toggleTrackMuteTool: ToolDefinition = {
	...toggleTrackMuteSchema,
	execute: async (
		args: Record<string, unknown>,
		_context: AgentContext,
	): Promise<{ trackId: string } | { error: string }> => {
		const trackId = args.trackId;

		if (typeof trackId !== "string" || !trackId.trim()) {
			return { error: "Invalid trackId" };
		}

		return EditorContextAdapter.toggleTrackMute({ trackId });
	},
};

toolRegistry.register(toggleTrackMuteSchema.name, toggleTrackMuteTool);
