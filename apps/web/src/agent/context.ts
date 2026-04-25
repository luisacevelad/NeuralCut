import { EditorCore } from "@/core";
import { TICKS_PER_SECOND } from "@/lib/wasm";
import { buildContextFromEditorState } from "@/agent/context-mapper";
import { BatchCommand } from "@/lib/commands";
import { AddTrackCommand, InsertElementCommand } from "@/lib/commands/timeline";
import { DEFAULT_NEW_ELEMENT_DURATION } from "@/lib/timeline/creation";
import { buildElementFromMedia } from "@/lib/timeline/element-utils";
import type {
	SceneTracks,
	TimelineElement,
	TimelineTrack,
	TrackType,
} from "@/lib/timeline";
import { canPlaceTimeSpansOnTrack } from "@/lib/timeline/placement/overlap";
import { validateElementTrackCompatibility } from "@/lib/timeline/placement";
import { findTrackInSceneTracks } from "@/lib/timeline/track-element-update";

/**
 * Thin adapter: the ONLY file in agent/ that imports from core/.
 * Returns a plain AgentContext POJO so tools never touch EditorCore directly.
 * Data mapping logic is extracted to context-mapper.ts for WASM-free testability.
 */
export const EditorContextAdapter = {
	getContext() {
		const core = EditorCore.getInstance();
		return buildContextFromEditorState({
			project: core.project.getActiveOrNull(),
			activeScene: core.scenes.getActiveSceneOrNull(),
			assets: core.media.getAssets(),
			currentTimeTicks: core.playback.getCurrentTime(),
			ticksPerSecond: TICKS_PER_SECOND,
		});
	},

	/**
	 * Resolve a media asset's File reference.
	 * If assetId is provided, finds the exact asset by ID.
	 * If omitted, returns the File for the first video or audio asset.
	 * Returns null when no matching asset exists.
	 * This is the ONLY sanctioned path for tools to obtain a File from EditorCore.
	 */
	resolveAssetFile(assetId?: string): File | null {
		const core = EditorCore.getInstance();
		const assets = core.media.getAssets();

		if (assetId !== undefined) {
			const asset = assets.find((a) => a.id === assetId);
			return asset?.file ?? null;
		}

		const firstMediaAsset = assets.find(
			(a) => a.type === "video" || a.type === "audio",
		);
		return firstMediaAsset?.file ?? null;
	},

	/**
	 * Check whether a media asset has an audio track.
	 * Returns undefined when the asset is not found.
	 */
	getAssetHasAudio(assetId: string): boolean | undefined {
		const core = EditorCore.getInstance();
		const asset = core.media.getAssets().find((a) => a.id === assetId);
		return asset?.hasAudio;
	},

	splitTimeline({
		times,
	}: {
		times: number[];
	}): { success: boolean; affectedElements: string[] } | { error: string } {
		const core = EditorCore.getInstance();
		const activeScene = core.scenes.getActiveSceneOrNull();
		if (!activeScene) {
			return { error: "No active timeline" };
		}

		if (!hasTimelineContent(activeScene.tracks)) {
			return { error: "No timeline content" };
		}

		const affectedElements = core.timeline.split({
			times: times.map((time) => secondsToTicks(time)),
		});
		return { success: true, affectedElements };
	},

	deleteTimelineElements({
		elementIds,
	}: {
		elementIds: string[];
	}): { success: boolean; deletedElements: string[] } | { error: string } {
		const core = EditorCore.getInstance();
		const activeScene = core.scenes.getActiveSceneOrNull();
		if (!activeScene) {
			return { error: "No active timeline" };
		}

		if (!hasTimelineContent(activeScene.tracks)) {
			return { error: "No timeline content" };
		}

		const requestedIds = [...new Set(elementIds)];
		const elements = findTimelineElementsByIds({
			tracks: activeScene.tracks,
			elementIds: requestedIds,
		});
		const foundIds = new Set(elements.map((element) => element.elementId));
		const missingIds = requestedIds.filter(
			(elementId) => !foundIds.has(elementId),
		);

		if (missingIds.length > 0) {
			return { error: `Timeline elements not found: ${missingIds.join(", ")}` };
		}

		core.timeline.deleteElements({ elements });
		return { success: true, deletedElements: requestedIds };
	},

	moveTimelineElements({
		elementIds,
		start,
		targetTrackId,
	}: {
		elementIds: string[];
		start: number;
		targetTrackId?: string;
	}):
		| {
				success: boolean;
				movedElements: Array<{
					elementId: string;
					trackId: string;
					start: number;
					end: number;
				}>;
		  }
		| { error: string } {
		const core = EditorCore.getInstance();
		const activeScene = core.scenes.getActiveSceneOrNull();
		if (!activeScene) {
			return { error: "No active timeline" };
		}

		if (!hasTimelineContent(activeScene.tracks)) {
			return { error: "No timeline content" };
		}

		const requestedIds = [...new Set(elementIds)];
		const elements = findTimelineElementsWithTracksByIds({
			tracks: activeScene.tracks,
			elementIds: requestedIds,
		});
		const foundIds = new Set(elements.map(({ element }) => element.id));
		const missingIds = requestedIds.filter(
			(elementId) => !foundIds.has(elementId),
		);

		if (missingIds.length > 0) {
			return { error: `Timeline elements not found: ${missingIds.join(", ")}` };
		}

		for (const { element, track } of elements) {
			const targetTrack = targetTrackId
				? findTrackInSceneTracks({
						tracks: activeScene.tracks,
						trackId: targetTrackId,
					})
				: track;
			if (!targetTrack) {
				return { error: `Target track not found: ${targetTrackId}` };
			}

			const validation = validateElementTrackCompatibility({
				element,
				track: targetTrack,
			});
			if (!validation.isValid) {
				return {
					error:
						validation.errorMessage ??
						"Element cannot be placed on target track",
				};
			}
		}

		const earliestStart = Math.min(
			...elements.map(({ element }) => element.startTime),
		);
		const delta = secondsToTicks(start) - earliestStart;

		for (const { element, track } of elements) {
			core.timeline.moveElement({
				sourceTrackId: track.id,
				targetTrackId: targetTrackId ?? track.id,
				elementId: element.id,
				newStartTime: element.startTime + delta,
			});
		}

		const updatedScene = core.scenes.getActiveSceneOrNull();
		const movedElements = updatedScene
			? findTimelineElementsWithTracksByIds({
					tracks: updatedScene.tracks,
					elementIds: requestedIds,
				}).map(({ element, track }) => ({
					elementId: element.id,
					trackId: track.id,
					start: ticksToSeconds(element.startTime),
					end: ticksToSeconds(element.startTime + element.duration),
				}))
			: [];

		return { success: true, movedElements };
	},

	addMediaToTimeline({
		assetId,
		startTime,
		trackType,
		duration: requestedDuration,
	}: {
		assetId: string;
		startTime: number;
		trackType: "main" | "overlay" | "audio";
		duration?: number;
	}): { elementId: string; trackId: string } | { error: string } {
		const core = EditorCore.getInstance();
		const activeScene = core.scenes.getActiveSceneOrNull();
		if (!activeScene) {
			return { error: "No active timeline" };
		}

		const asset = core.media.getAssets().find((item) => item.id === assetId);
		if (!asset) {
			return { error: "Asset not found" };
		}

		if (
			!isAssetCompatibleWithRequestedTrack({ assetType: asset.type, trackType })
		) {
			return { error: "Invalid track type for asset" };
		}

		const startTimeTicks = secondsToTicks(startTime);
		const duration = resolveRequestedElementDuration({
			assetDuration: asset.duration,
			assetType: asset.type,
			requestedDuration,
		});
		if (duration === null) {
			return { error: "Duration exceeds source duration" };
		}
		const element = buildElementFromMedia({
			mediaId: asset.id,
			mediaType: asset.type,
			name: asset.name,
			duration,
			startTime: startTimeTicks,
			buffer:
				asset.type === "audio"
					? new AudioBuffer({ length: 1, sampleRate: 44100 })
					: undefined,
		});

		const placement = resolveMediaInsertionPlacement({
			tracks: activeScene.tracks,
			trackType,
			startTime: startTimeTicks,
			duration,
		});
		const insertCommand = new InsertElementCommand({
			element,
			placement: { mode: "explicit", trackId: placement.trackId },
		});

		if (placement.addTrackCommand) {
			core.command.execute({
				command: new BatchCommand([placement.addTrackCommand, insertCommand]),
			});
		} else {
			core.command.execute({ command: insertCommand });
		}

		const insertedTrackId = insertCommand.getTrackId() ?? placement.trackId;
		return {
			elementId: insertCommand.getElementId(),
			trackId: insertedTrackId,
		};
	},

	updateTimelineElementTiming({
		elementId,
		start,
		end,
		duration,
	}: {
		elementId: string;
		start?: number;
		end?: number;
		duration?: number;
	}):
		| {
				success: boolean;
				elementId: string;
				trackId: string;
				start: number;
				end: number;
				duration: number;
		  }
		| { error: string } {
		const core = EditorCore.getInstance();
		const activeScene = core.scenes.getActiveSceneOrNull();
		if (!activeScene) {
			return { error: "No active timeline" };
		}

		if (!hasTimelineContent(activeScene.tracks)) {
			return { error: "No timeline content" };
		}

		const [resolved] = findTimelineElementsWithTracksByIds({
			tracks: activeScene.tracks,
			elementIds: [elementId],
		});
		if (!resolved) {
			return { error: `Timeline element not found: ${elementId}` };
		}

		const patch = buildTimingPatch({
			element: resolved.element,
			start,
			end,
			duration,
		});
		if ("error" in patch) {
			return patch;
		}

		core.timeline.updateElements({
			updates: [
				{
					trackId: resolved.track.id,
					elementId: resolved.element.id,
					patch,
				},
			],
		});

		const updatedScene = core.scenes.getActiveSceneOrNull();
		const [updated] = updatedScene
			? findTimelineElementsWithTracksByIds({
					tracks: updatedScene.tracks,
					elementIds: [elementId],
				})
			: [];
		const element = updated?.element ?? resolved.element;
		const track = updated?.track ?? resolved.track;

		return {
			success: true,
			elementId: element.id,
			trackId: track.id,
			start: ticksToSeconds(element.startTime),
			end: ticksToSeconds(element.startTime + element.duration),
			duration: ticksToSeconds(element.duration),
		};
	},
};

function secondsToTicks(seconds: number): number {
	return Math.round(seconds * TICKS_PER_SECOND);
}

function ticksToSeconds(ticks: number): number {
	return ticks / TICKS_PER_SECOND;
}

function resolveRequestedElementDuration({
	assetDuration,
	assetType,
	requestedDuration,
}: {
	assetDuration?: number;
	assetType: "video" | "audio" | "image";
	requestedDuration?: number;
}): number | null {
	if (requestedDuration === undefined) {
		return assetDuration != null
			? Math.round(assetDuration * TICKS_PER_SECOND)
			: DEFAULT_NEW_ELEMENT_DURATION;
	}

	if (
		(assetType === "video" || assetType === "audio") &&
		assetDuration != null &&
		requestedDuration > assetDuration
	) {
		return null;
	}

	return secondsToTicks(requestedDuration);
}

function buildTimingPatch({
	element,
	start,
	end,
	duration,
}: {
	element: TimelineElement;
	start?: number;
	end?: number;
	duration?: number;
}): Partial<TimelineElement> | { error: string } {
	const nextStart =
		start === undefined ? element.startTime : secondsToTicks(start);
	const nextDuration = resolveTimingDuration({
		element,
		startTicks: nextStart,
		end,
		duration,
	});
	if ("error" in nextDuration) {
		return nextDuration;
	}

	return {
		...(start !== undefined && { startTime: nextStart }),
		...(nextDuration.duration !== element.duration && {
			duration: nextDuration.duration,
		}),
	};
}

function resolveTimingDuration({
	element,
	startTicks,
	end,
	duration,
}: {
	element: TimelineElement;
	startTicks: number;
	end?: number;
	duration?: number;
}): { duration: number } | { error: string } {
	if (duration !== undefined && end !== undefined) {
		const durationTicks = secondsToTicks(duration);
		const endDerivedDuration = secondsToTicks(end) - startTicks;
		if (endDerivedDuration !== durationTicks) {
			return { error: "Conflicting timing values" };
		}
	}

	const nextDuration =
		duration !== undefined
			? secondsToTicks(duration)
			: end !== undefined
				? secondsToTicks(end) - startTicks
				: element.duration;

	if (nextDuration <= 0) {
		return { error: "Invalid time range" };
	}

	const maxDuration = getMaxElementDurationTicks({ element });
	if (maxDuration !== undefined && nextDuration > maxDuration) {
		return { error: "Duration exceeds source duration" };
	}

	return { duration: nextDuration };
}

function getMaxElementDurationTicks({
	element,
}: {
	element: TimelineElement;
}): number | undefined {
	if (
		(element.type !== "video" && element.type !== "audio") ||
		typeof element.sourceDuration !== "number"
	) {
		return undefined;
	}

	return Math.max(
		0,
		element.sourceDuration - element.trimStart - element.trimEnd,
	);
}

function isAssetCompatibleWithRequestedTrack({
	assetType,
	trackType,
}: {
	assetType: "video" | "audio" | "image";
	trackType: "main" | "overlay" | "audio";
}): boolean {
	if (trackType === "audio") {
		return assetType === "audio";
	}
	return assetType === "video" || assetType === "image";
}

function resolveMediaInsertionPlacement({
	tracks,
	trackType,
	startTime,
	duration,
}: {
	tracks: SceneTracks;
	trackType: "main" | "overlay" | "audio";
	startTime: number;
	duration: number;
}): { trackId: string; addTrackCommand?: AddTrackCommand } {
	if (trackType === "main") {
		return { trackId: tracks.main.id };
	}

	const compatibleTrackType: TrackType =
		trackType === "audio" ? "audio" : "video";
	const candidateTracks = trackType === "audio" ? tracks.audio : tracks.overlay;
	const availableTrack = candidateTracks.find(
		(track) =>
			track.type === compatibleTrackType &&
			canPlaceTimeSpansOnTrack({
				track,
				timeSpans: [{ startTime, duration }],
			}),
	);
	if (availableTrack) {
		return { trackId: availableTrack.id };
	}

	const addTrackCommand = new AddTrackCommand(compatibleTrackType);
	return {
		trackId: addTrackCommand.getTrackId(),
		addTrackCommand,
	};
}

function hasTimelineContent(tracks: SceneTracks): boolean {
	return (
		tracks.main.elements.length > 0 ||
		tracks.overlay.some((track) => track.elements.length > 0) ||
		tracks.audio.some((track) => track.elements.length > 0)
	);
}

function findTimelineElementsByIds({
	tracks,
	elementIds,
}: {
	tracks: SceneTracks;
	elementIds: string[];
}): Array<{ trackId: string; elementId: string }> {
	const requestedIds = new Set(elementIds);
	const result: Array<{ trackId: string; elementId: string }> = [];
	const allTracks = [tracks.main, ...tracks.overlay, ...tracks.audio];

	for (const track of allTracks) {
		for (const element of track.elements) {
			if (requestedIds.has(element.id)) {
				result.push({ trackId: track.id, elementId: element.id });
			}
		}
	}

	return result;
}

function findTimelineElementsWithTracksByIds({
	tracks,
	elementIds,
}: {
	tracks: SceneTracks;
	elementIds: string[];
}): Array<{ track: TimelineTrack; element: TimelineElement }> {
	const requestedIds = new Set(elementIds);
	const result: Array<{ track: TimelineTrack; element: TimelineElement }> = [];
	const allTracks = [tracks.main, ...tracks.overlay, ...tracks.audio];

	for (const track of allTracks) {
		for (const element of track.elements) {
			if (requestedIds.has(element.id)) {
				result.push({ track, element });
			}
		}
	}

	return result;
}

export { buildSystemPrompt } from "@/agent/system-prompt";
