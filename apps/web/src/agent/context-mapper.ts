import type { AgentContext, AgentTimelineTrack } from "@/agent/types";

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
		timelineTracks: buildTimelineTracks(params.activeScene),
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
	id?: string;
	type?: string;
	elements?: unknown[];
};

function buildTimelineTracks(
	scene: ActiveSceneInput | null,
): AgentTimelineTrack[] | undefined {
	if (!scene?.tracks) {
		return undefined;
	}

	const tracks: AgentTimelineTrack[] = [];

	if (scene.tracks.main) {
		tracks.push(toTimelineTrack(scene.tracks.main, "main"));
	}

	for (const track of scene.tracks.overlay ?? []) {
		tracks.push(toTimelineTrack(track, mapOverlayTrackType(track.type)));
	}

	for (const track of scene.tracks.audio ?? []) {
		tracks.push(toTimelineTrack(track, "audio"));
	}

	return tracks;
}

function toTimelineTrack(
	track: TrackInput,
	type: AgentTimelineTrack["type"],
): AgentTimelineTrack {
	return {
		trackId: track.id ?? "",
		type,
		elements: (track.elements ?? [])
			.filter(hasTimelineElementShape)
			.map((element) => ({
				elementId: element.id,
				type: element.type,
				...(hasMediaId(element) ? { assetId: element.mediaId } : {}),
				...(element.name ? { name: element.name } : {}),
				start: element.startTime,
				end: element.startTime + element.duration,
			})),
	};
}

function mapOverlayTrackType(
	type: string | undefined,
): AgentTimelineTrack["type"] {
	if (type === "text") return "text";
	if (type === "effect") return "effect";
	return "overlay";
}

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

function hasTimelineElementShape(element: unknown): element is {
	id: string;
	type: string;
	name?: string;
	startTime: number;
	duration: number;
} {
	return (
		typeof element === "object" &&
		element !== null &&
		"id" in element &&
		"type" in element &&
		"startTime" in element &&
		"duration" in element &&
		typeof element.id === "string" &&
		typeof element.type === "string" &&
		(!("name" in element) || typeof element.name === "string") &&
		typeof element.startTime === "number" &&
		typeof element.duration === "number"
	);
}
