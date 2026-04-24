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
			? `Active media assets:\n${context.mediaAssets.map((m) => `- [id: ${m.id}] ${m.name} (${m.type}, ${m.duration}s)`).join("\n")}`
			: "No media assets loaded.";

	const parts = [
		"You are an AI assistant embedded in the NeuralCut video editor.",
		`Project: ${context.projectId ?? "No project loaded"}`,
		`Active scene: ${context.activeSceneId ?? "No active scene"}`,
		`Playback position: ${context.playbackTimeMs}ms`,
		mediaSection,
	];

	if (context.mediaAssets.length > 0) {
		parts.push(
			'IMPORTANT: When calling tools that accept an "assetId" parameter, always use the internal "id" value (e.g., "v1"), NOT the filename or display name.',
		);
	}

	if (tools && tools.length > 0) {
		const toolList = tools
			.map((t) => `- ${t.name}: ${t.description}`)
			.join("\n");
		parts.push(
			`Available tools:\n${toolList}`,
			'For questions about what is visible or audible in a media asset, never answer that you cannot see or hear the media if load_context is available. First infer the asset from the active assets or timeline; if needed call list_project_assets or list_timeline, then call load_context with the discovered internal id or timeline element ids.',
			'If load_context has loaded media and the conversation contains an attached fileData part, treat it as the actual video/audio/image content. You may answer visual and audio questions directly from that loaded media without calling extraction tools unless the user asks for a separate extraction workflow.',
			"When you need to perform an action matching one of these tools, call the appropriate tool. For all other requests, respond directly in plain text.",
		);
	}

	return parts.join("\n");
}
