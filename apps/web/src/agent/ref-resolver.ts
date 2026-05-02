import type { AgentContext, AgentTimelineTrack } from "@/agent/types";

type ResolveResult =
	| { resolved: string }
	| { error: string };

export type ResolvedAsset = {
	assetId: string;
	assetName: string;
};

export type ResolvedElement = {
	elementId: string;
	trackId: string;
	ref: string;
};

export type ResolvedTrack = {
	trackId: string;
	trackRef: string;
	trackLabel: string;
};

export function resolveAsset(
	target: string,
	context: AgentContext,
): ResolvedAsset | { error: string } {
	const asset = context.mediaAssets.find((a) => a.id === target);
	if (asset) {
		return { assetId: asset.id, assetName: asset.name };
	}

	const byName = context.mediaAssets.filter(
		(a) => a.name === target || a.name.toLowerCase() === target.toLowerCase(),
	);
	if (byName.length === 1) {
		return { assetId: byName[0].id, assetName: byName[0].name };
	}
	if (byName.length > 1) {
		return {
			error: `Ambiguous asset "${target}". Matches: ${byName.map((a) => `"${a.name}" (${a.id})`).join(", ")}`,
		};
	}

	return { error: `Asset not found: "${target}". Available: ${context.mediaAssets.map((a) => a.name).join(", ")}` };
}

export function resolveElement(
	target: string,
	context: AgentContext,
): ResolvedElement | { error: string } {
	const tracks = context.timelineTracks ?? [];

	if (looksLikeRef(target)) {
		return resolveByRef(target, tracks);
	}

	const byId = findElementAcrossTracks(tracks, target);
	if (byId) {
		return {
			elementId: byId.element.elementId,
			trackId: byId.track.trackId,
			ref: byId.element.ref,
		};
	}

	return resolveByContent(target, tracks);
}

export function resolveElements(
	targets: string[],
	context: AgentContext,
): { resolved: ResolvedElement[] } | { error: string } {
	const results: ResolvedElement[] = [];
	for (const target of targets) {
		const result = resolveElement(target, context);
		if ("error" in result) return result;
		results.push(result);
	}
	return { resolved: results };
}

export function resolveTrack(
	target: string,
	context: AgentContext,
): ResolvedTrack | { error: string } {
	const tracks = context.timelineTracks ?? [];

	const byId = tracks.find((t) => t.trackId === target);
	if (byId) {
		return { trackId: byId.trackId, trackRef: byId.trackRef, trackLabel: byId.trackLabel };
	}

	const byRef = tracks.find((t) => t.trackRef === target);
	if (byRef) {
		return { trackId: byRef.trackId, trackRef: byRef.trackRef, trackLabel: byRef.trackLabel };
	}

	const byLabel = tracks.filter(
		(t) => t.trackLabel.toLowerCase() === target.toLowerCase(),
	);
	if (byLabel.length === 1) {
		return { trackId: byLabel[0].trackId, trackRef: byLabel[0].trackRef, trackLabel: byLabel[0].trackLabel };
	}
	if (byLabel.length > 1) {
		return {
			error: `Ambiguous track "${target}". Matches: ${byLabel.map((t) => `${t.trackRef} (${t.trackLabel})`).join(", ")}`,
		};
	}

	const byType = tracks.filter((t) => t.type === target);
	if (byType.length === 1) {
		return { trackId: byType[0].trackId, trackRef: byType[0].trackRef, trackLabel: byType[0].trackLabel };
	}

	return {
		error: `Track not found: "${target}". Available: ${tracks.map((t) => t.trackRef).join(", ")}`,
	};
}

function looksLikeRef(target: string): boolean {
	return /^(clip|text|effect|element)-\d+$/i.test(target);
}

function resolveByRef(
	ref: string,
	tracks: AgentTimelineTrack[],
): ResolvedElement | { error: string } {
	for (const track of tracks) {
		for (const element of track.elements) {
			if (element.ref.toLowerCase() === ref.toLowerCase()) {
				return {
					elementId: element.elementId,
					trackId: track.trackId,
					ref: element.ref,
				};
			}
		}
	}
	return { error: `Element ref "${ref}" not found in timeline.` };
}

function resolveByContent(
	target: string,
	tracks: AgentTimelineTrack[],
): ResolvedElement | { error: string } {
	const matches: Array<{ track: AgentTimelineTrack; element: AgentTimelineTrack["elements"][number] }> = [];

	for (const track of tracks) {
		for (const element of track.elements) {
			if (
				element.assetName === target ||
				element.name === target ||
				(element.content && element.content.includes(target))
			) {
				matches.push({ track, element });
			}
		}
	}

	if (matches.length === 1) {
		return {
			elementId: matches[0].element.elementId,
			trackId: matches[0].track.trackId,
			ref: matches[0].element.ref,
		};
	}

	if (matches.length > 1) {
		return {
			error: `Ambiguous target "${target}". Matches: ${matches.map((m) => `${m.element.ref}${m.element.assetName ? ` (${m.element.assetName})` : ""}`).join(", ")}`,
		};
	}

	return { error: `Element not found: "${target}". Use list_timeline to discover refs.` };
}

function findElementAcrossTracks(
	tracks: AgentTimelineTrack[],
	elementId: string,
): { track: AgentTimelineTrack; element: AgentTimelineTrack["elements"][number] } | null {
	for (const track of tracks) {
		const element = track.elements.find((e) => e.elementId === elementId);
		if (element) return { track, element };
	}
	return null;
}
