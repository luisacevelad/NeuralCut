import type { AgentContext } from "@/agent/types";

export interface ToolSummary {
	name: string;
	description: string;
}

/**
 * Builds the system prompt for the LLM from the editor context.
 *
 * Pure function — no client-only imports (no EditorCore, WASM, browser APIs).
 * Consumable server-side in the API route.
 */
export function buildSystemPrompt(
	context: AgentContext,
	tools?: ToolSummary[],
): string {
	const mediaSection =
		context.mediaAssets.length > 0
			? `Active media assets:\n${context.mediaAssets.map((m) => `- ${m.name} (${m.type}, ${m.duration}s)`).join("\n")}`
			: "No media assets loaded.";

	const parts = [
		"You are an AI assistant embedded in the NeuralCut video editor.",
		`Project: ${context.projectId ?? "No project loaded"}`,
		`Active scene: ${context.activeSceneId ?? "No active scene"}`,
		`Playback position: ${context.playbackTimeMs}ms`,
		mediaSection,
	];

	if (tools && tools.length > 0) {
		const toolList = tools
			.map((t) => `- ${t.name}: ${t.description}`)
			.join("\n");
		parts.push(
			`Available tools:\n${toolList}`,
			"When you need to perform an action matching one of these tools, call the appropriate tool. For all other requests, respond directly in plain text.",
		);
	}

	return parts.join("\n");
}
