import type { AgentContext, AgentTimelineTrack } from "@/agent/types";

type AssetLookup = Map<string, { name: string }>;

export function buildContextFromEditorState(params: {
	project: ProjectInput | null;
	activeScene: ActiveSceneInput | null;
	assets: Array<{ id: string; name: string; type: string; duration?: number }>;
	currentTimeTicks: number;
	ticksPerSecond: number;
}): AgentContext {
	const usedMediaIds = collectUsedMediaIds(params.activeScene);
	const assetLookup = new Map<string, { name: string }>();
	for (const a of params.assets) {
		assetLookup.set(a.id, { name: a.name });
	}

	const project = params.project;

	return {
		projectId: project?.metadata.id ?? null,
		activeSceneId: params.activeScene?.id ?? null,
		fps: project ? projectFpsToFloat(project.settings?.fps) : null,
		duration: project?.metadata.duration ?? null,
		resolution: project?.settings?.canvasSize ?? null,
		aspectRatio: project?.settings?.canvasSize
			? computeAspectRatio(project.settings.canvasSize)
			: null,
		projectName: project?.metadata.name ?? null,
		mediaAssets: params.assets.map((a) => ({
			id: a.id,
			name: a.name,
			type: a.type,
			duration: a.duration ?? 0,
			usedInTimeline: usedMediaIds.has(a.id),
		})),
		timelineTracks: buildTimelineTracks(
			params.activeScene,
			params.ticksPerSecond,
			assetLookup,
		),
		playbackTimeMs: Math.round(
			(params.currentTimeTicks / params.ticksPerSecond) * 1000,
		),
	};
}

type ProjectInput = {
	metadata: { id: string; name?: string; duration?: number };
	settings?: {
		fps?: { numerator: number; denominator: number };
		canvasSize?: { width: number; height: number };
	};
};

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
	ticksPerSecond: number,
	assetLookup: AssetLookup,
): AgentTimelineTrack[] | undefined {
	if (!scene?.tracks) {
		return undefined;
	}

	const tracks: AgentTimelineTrack[] = [];
	const overlayTracks = scene.tracks.overlay ?? [];
	let position = 0;
	const counters: Record<string, number> = {};
	const elementCounters: Record<string, number> = {};

	for (let index = 0; index < overlayTracks.length; index++) {
		const track = overlayTracks[index];
		const trackType = mapOverlayTrackType(track.type);
		const trackRef = nextRef(counters, trackType);
		tracks.push(
			toTimelineTrack(
				track,
				trackType,
				trackRef,
				ticksPerSecond,
				assetLookup,
				elementCounters,
				{
					position: position++,
					visualLayer: overlayTracks.length - index,
					isVisualLayer: true,
					stacking: index === 0 ? "top" : "above_main",
				},
			),
		);
	}

	if (scene.tracks.main) {
		const trackRef = nextRef(counters, "main");
		tracks.push(
			toTimelineTrack(
				scene.tracks.main,
				"main",
				trackRef,
				ticksPerSecond,
				assetLookup,
				elementCounters,
				{
					position: position++,
					visualLayer: 0,
					isVisualLayer: true,
					stacking: "main",
				},
			),
		);
	}

	for (const track of scene.tracks.audio ?? []) {
		const trackRef = nextRef(counters, "audio");
		tracks.push(
			toTimelineTrack(
				track,
				"audio",
				trackRef,
				ticksPerSecond,
				assetLookup,
				elementCounters,
				{
					position: position++,
					visualLayer: null,
					isVisualLayer: false,
					stacking: "audio",
				},
			),
		);
	}

	return tracks;
}

function nextRef(counters: Record<string, number>, prefix: string): string {
	const n = (counters[prefix] ?? 0) + 1;
	counters[prefix] = n;
	return `${prefix}-${n}`;
}

function toTimelineTrack(
	track: TrackInput,
	type: AgentTimelineTrack["type"],
	trackRef: string,
	ticksPerSecond: number,
	assetLookup: AssetLookup,
	elementCounters: Record<string, number>,
	stacking: Pick<
		AgentTimelineTrack,
		"position" | "visualLayer" | "isVisualLayer" | "stacking"
	>,
): AgentTimelineTrack {
	const trackLabel = buildTrackLabel(type, stacking.stacking);

	return {
		trackId: track.id ?? "",
		trackRef,
		trackLabel,
		type,
		...stacking,
		elements: (track.elements ?? [])
			.filter(hasTimelineElementShape)
			.map((element) => {
				const start = toSeconds(element.startTime, ticksPerSecond);
				const end = toSeconds(
					element.startTime + element.duration,
					ticksPerSecond,
				);
				const duration = end - start;
				const assetId = hasMediaId(element) ? element.mediaId : undefined;
				const assetName = assetId ? assetLookup.get(assetId)?.name : undefined;
				const elementType = mapElementType(element.type, assetId !== undefined);
				const ref = buildElementRef(elementCounters, elementType, assetName);
				const hasContent = hasTextContent(element);
				const content = hasContent
					? (element as { content: string }).content
					: undefined;
				const displayName = buildDisplayName(assetName, content, element.name, ref);

				return {
					elementId: element.id,
					ref,
					displayName,
					type: element.type,
					...(assetId ? { assetId } : {}),
					...(assetName ? { assetName } : {}),
					...(element.name ? { name: element.name } : {}),
					...(hasContent ? { content } : {}),
					duration: Math.round(duration * 1000) / 1000,
					...(hasNonEmptyArray(element, "masks") ? { hasMask: true } : {}),
					...(hasNonEmptyArray(element, "effects") ? { hasEffects: true } : {}),
					...(element.hidden === true ? { isHidden: true } : {}),
					start: Math.round(start * 1000) / 1000,
					end: Math.round(end * 1000) / 1000,
					...extractTransformFields(element),
					...extractOpacityField(element),
					...extractAudioFields(element),
				};
			}),
	};
}

function buildTrackLabel(
	type: AgentTimelineTrack["type"],
	stacking: AgentTimelineTrack["stacking"],
): string {
	if (type === "text") return "Text";
	if (type === "effect") return "Effects";
	if (type === "audio") return "Audio";
	if (stacking === "main") return "Main";
	if (stacking === "top") return "Overlay (top)";
	return "Overlay";
}

function mapElementType(rawType: string, hasAsset: boolean): string {
	if (rawType === "text" || rawType === "caption") return "text";
	if (rawType === "effect") return "effect";
	if (hasAsset) return "clip";
	return "element";
}

function slugify(name: string): string {
	return name
		.replace(/\.[^.]+$/, "")
		.replace(/[^a-zA-Z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.toLowerCase()
		.slice(0, 30)
		.replace(/-+$/, "");
}

function buildElementRef(
	elementCounters: Record<string, number>,
	elementType: string,
	assetName: string | undefined,
): string {
	if (assetName) {
		const slug = slugify(assetName);
		if (slug.length > 0) {
			return nextRef(elementCounters, slug);
		}
	}
	return nextRef(elementCounters, elementType);
}

function buildDisplayName(
	assetName: string | undefined,
	content: string | undefined,
	name: string | undefined,
	ref: string,
): string {
	if (assetName) return assetName;
	if (content) {
		const trimmed = content.trim();
		if (trimmed.length <= 40) return `Text: ${trimmed}`;
		return `Text: ${trimmed.slice(0, 37)}...`;
	}
	return name ?? ref;
}

function toSeconds(ticks: number, ticksPerSecond: number): number {
	return ticks / ticksPerSecond;
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
	masks?: unknown[];
	effects?: unknown[];
	hidden?: boolean;
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

function hasNonEmptyArray(obj: unknown, key: string): boolean {
	if (typeof obj !== "object" || obj === null || !(key in obj)) return false;
	const value = (obj as Record<string, unknown>)[key];
	return Array.isArray(value) && value.length > 0;
}

function projectFpsToFloat(
	fps: { numerator: number; denominator: number } | undefined,
): number | null {
	if (!fps) return null;
	return fps.numerator / fps.denominator;
}

function computeAspectRatio(size: { width: number; height: number }): string {
	const g = gcd(size.width, size.height);
	return `${size.width / g}:${size.height / g}`;
}

function gcd(a: number, b: number): number {
	return b === 0 ? a : gcd(b, a % b);
}

function extractTransformFields(
	element: unknown,
): Record<string, number> {
	if (!hasTransform(element)) return {};
	return {
		positionX: element.transform.position.x,
		positionY: element.transform.position.y,
		scaleX: element.transform.scaleX,
		scaleY: element.transform.scaleY,
		rotation: element.transform.rotate,
	};
}

function extractOpacityField(
	element: unknown,
): Record<string, number> {
	if (
		typeof element === "object" &&
		element !== null &&
		"opacity" in element &&
		typeof element.opacity === "number"
	) {
		return { opacity: element.opacity };
	}
	return {};
}

function extractAudioFields(
	element: unknown,
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	if (
		typeof element === "object" &&
		element !== null &&
		"volume" in element &&
		typeof element.volume === "number"
	) {
		result.volume = element.volume;
	}
	if (
		typeof element === "object" &&
		element !== null &&
		"muted" in element &&
		typeof element.muted === "boolean"
	) {
		result.muted = element.muted;
	}
	return result;
}

function hasTransform(
	element: unknown,
): element is {
	transform: {
		position: { x: number; y: number };
		scaleX: number;
		scaleY: number;
		rotate: number;
	};
} {
	if (typeof element !== "object" || element === null || !("transform" in element)) {
		return false;
	}
	const t = (element as { transform: unknown }).transform;
	if (typeof t !== "object" || t === null) return false;
	return (
		"position" in t &&
		"scaleX" in t &&
		"scaleY" in t &&
		"rotate" in t &&
		typeof t.scaleX === "number" &&
		typeof t.scaleY === "number" &&
		typeof t.rotate === "number" &&
		typeof (t as { position: unknown }).position === "object" &&
		(t as { position: unknown }).position !== null &&
		"x" in (t as { position: Record<string, unknown> }).position &&
		"y" in (t as { position: Record<string, unknown> }).position &&
		typeof (t as { position: Record<string, unknown> }).position.x === "number" &&
		typeof (t as { position: Record<string, unknown> }).position.y === "number"
	);
}
