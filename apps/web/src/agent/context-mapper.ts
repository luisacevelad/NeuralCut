import type { AgentContext } from "@/agent/types";

/**
 * Pure data-mapping function extracted from EditorContextAdapter.
 * WASM-free — testable in bun:test without loading EditorCore.
 *
 * Takes pre-extracted editor state and maps it to an AgentContext POJO.
 */
export function buildContextFromEditorState(params: {
	project: { metadata: { id: string } } | null;
	activeScene: ActiveSceneInput | null;
	assets: Array<{ id: string; name: string; type: string; duration?: number }>;
	currentTimeTicks: number;
	ticksPerSecond: number;
}): AgentContext {
	const usedMediaIds = collectUsedMediaIds(params.activeScene);

	return {
		projectId: params.project?.metadata.id ?? null,
		activeSceneId: params.activeScene?.id ?? null,
		mediaAssets: params.assets.map((a) => ({
			id: a.id,
			name: a.name,
			type: a.type,
			duration: a.duration ?? 0,
			usedInTimeline: usedMediaIds.has(a.id),
		})),
		playbackTimeMs: Math.round(
			(params.currentTimeTicks / params.ticksPerSecond) * 1000,
		),
	};
}

type ActiveSceneInput = {
	id: string;
	tracks?: {
		main?: TrackInput;
		overlay?: TrackInput[];
		audio?: TrackInput[];
	};
};

type TrackInput = {
	elements?: unknown[];
};

function collectUsedMediaIds(scene: ActiveSceneInput | null): Set<string> {
	const ids = new Set<string>();
	if (!scene?.tracks) {
		return ids;
	}

	const tracks = [
		scene.tracks.main,
		...(scene.tracks.overlay ?? []),
		...(scene.tracks.audio ?? []),
	].filter((track): track is TrackInput => Boolean(track));

	for (const track of tracks) {
		for (const element of track.elements ?? []) {
			if (hasMediaId(element)) {
				ids.add(element.mediaId);
			}
		}
	}

	return ids;
}

function hasMediaId(element: unknown): element is { mediaId: string } {
	return (
		typeof element === "object" &&
		element !== null &&
		"mediaId" in element &&
		typeof element.mediaId === "string"
	);
}
