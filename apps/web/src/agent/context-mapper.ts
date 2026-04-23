import type { AgentContext } from "@/agent/types";

/**
 * Pure data-mapping function extracted from EditorContextAdapter.
 * WASM-free — testable in bun:test without loading EditorCore.
 *
 * Takes pre-extracted editor state and maps it to an AgentContext POJO.
 */
export function buildContextFromEditorState(params: {
	project: { metadata: { id: string } } | null;
	activeScene: { id: string } | null;
	assets: Array<{ id: string; name: string; type: string; duration?: number }>;
	currentTimeTicks: number;
	ticksPerSecond: number;
}): AgentContext {
	return {
		projectId: params.project?.metadata.id ?? null,
		activeSceneId: params.activeScene?.id ?? null,
		mediaAssets: params.assets.map((a) => ({
			id: a.id,
			name: a.name,
			type: a.type,
			duration: a.duration ?? 0,
		})),
		playbackTimeMs: Math.round(
			(params.currentTimeTicks / params.ticksPerSecond) * 1000,
		),
	};
}
