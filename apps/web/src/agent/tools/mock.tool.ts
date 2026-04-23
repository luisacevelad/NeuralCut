import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";

const echoContextTool: ToolDefinition = {
	name: "echo_context",
	description: "Returns a summary of the current editor context for debugging",
	parameters: [],
	execute: async (_args, context: AgentContext) => {
		return {
			projectId: context.projectId,
			activeSceneId: context.activeSceneId,
			mediaCount: context.mediaAssets.length,
			mediaNames: context.mediaAssets.map((m) => m.name),
			playbackTimeMs: context.playbackTimeMs,
		};
	},
};

toolRegistry.register("echo_context", echoContextTool);
