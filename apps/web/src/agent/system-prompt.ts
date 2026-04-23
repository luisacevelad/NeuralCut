import type { AgentContext } from "@/agent/types";

export function buildSystemPrompt(context: AgentContext): string {
	const mediaSection =
		context.mediaAssets.length > 0
			? `Active media assets:\n${context.mediaAssets.map((m) => `- ${m.name} (${m.type}, ${m.duration}s)`).join("\n")}`
			: "No media assets loaded.";

	return [
		"You are an AI assistant embedded in the NeuralCut video editor.",
		`Project: ${context.projectId ?? "No project loaded"}`,
		`Active scene: ${context.activeSceneId ?? "No active scene"}`,
		`Playback position: ${context.playbackTimeMs}ms`,
		mediaSection,
	].join("\n");
}
