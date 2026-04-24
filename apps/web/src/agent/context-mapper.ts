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
	const overlayTracks = scene.tracks.overlay ?? [];
	let position = 0;

	for (let index = 0; index < overlayTracks.length; index++) {
		const track = overlayTracks[index];
		tracks.push(
			toTimelineTrack(track, mapOverlayTrackType(track.type), {
				position: position++,
				visualLayer: overlayTracks.length - index,
				isVisualLayer: true,
				stacking: index === 0 ? "top" : "above_main",
			}),
		);
	}

	if (scene.tracks.main) {
		tracks.push(
			toTimelineTrack(scene.tracks.main, "main", {
				position: position++,
				visualLayer: 0,
				isVisualLayer: true,
				stacking: "main",
			}),
		);
	}

	for (const track of scene.tracks.audio ?? []) {
		tracks.push(
			toTimelineTrack(track, "audio", {
				position: position++,
				visualLayer: null,
				isVisualLayer: false,
				stacking: "audio",
			}),
		);
	}

	return tracks;
}

function toTimelineTrack(
	track: TrackInput,
	type: AgentTimelineTrack["type"],
	stacking: Pick<
		AgentTimelineTrack,
		"position" | "visualLayer" | "isVisualLayer" | "stacking"
	>,
): AgentTimelineTrack {
	return {
		trackId: track.id ?? "",
		type,
		...stacking,
		elements: (track.elements ?? [])
			.filter(hasTimelineElementShape)
			.map((element) => ({
				elementId: element.id,
				type: element.type,
				...(hasMediaId(element) ? { assetId: element.mediaId } : {}),
				...(element.name ? { name: element.name } : {}),
				...(hasTextContent(element) ? { content: element.content } : {}),
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

function hasTextContent(element: unknown): element is { content: string } {
	return (
		typeof element === "object" &&
		element !== null &&
		"content" in element &&
		typeof element.content === "string"
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
