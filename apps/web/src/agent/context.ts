import { EditorCore } from "@/core";
import { TICKS_PER_SECOND } from "@/lib/wasm";
import { buildContextFromEditorState } from "@/agent/context-mapper";
import { BatchCommand } from "@/lib/commands";
import { AddTrackCommand, InsertElementCommand } from "@/lib/commands/timeline";
import { DEFAULT_NEW_ELEMENT_DURATION } from "@/lib/timeline/creation";
import {
	buildElementFromMedia,
	buildEffectElement,
	buildTextElement,
} from "@/lib/timeline/element-utils";
import { DEFAULTS } from "@/lib/timeline/defaults";
import type {
	SceneTracks,
	TextBackground,
	TextElement,
	TimelineElement,
	TimelineTrack,
	TrackType,
} from "@/lib/timeline";
import type { TextStyleOverrides } from "@/agent/tools/add-text.tool";
import type { UpdateTextArgs } from "@/agent/tools/update-text.tool";
import { canPlaceTimeSpansOnTrack } from "@/lib/timeline/placement/overlap";
import { validateElementTrackCompatibility } from "@/lib/timeline/placement";
import { findTrackInSceneTracks } from "@/lib/timeline/track-element-update";
import { effectsRegistry } from "@/lib/effects";
import { masksRegistry, buildDefaultMaskInstance } from "@/lib/masks";
import type { MaskType } from "@/lib/masks/types";
import type { MaskableElement } from "@/lib/timeline";
import { isMaskableElement } from "@/lib/timeline/element-utils";
import type { BlendMode, Transform } from "@/lib/rendering";

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

	addText({
		text,
		start,
		end,
		position,
		style = "plain",
		color,
		fontSize,
		fontFamily,
		fontWeight,
		fontStyle,
		textAlign,
		letterSpacing,
		positionX,
		positionY,
		background,
	}: {
		text: string;
		start: number;
		end: number;
		position: "top" | "center" | "bottom";
		style?: "plain" | "subtitle" | "hook" | "label";
	} & TextStyleOverrides):
		| { elementId: string; trackId: string }
		| { error: string } {
		const core = EditorCore.getInstance();
		const activeScene = core.scenes.getActiveSceneOrNull();
		if (!activeScene) {
			return { error: "No active timeline" };
		}

		const startTicks = secondsToTicks(start);
		const duration = secondsToTicks(end) - startTicks;
		if (duration <= 0) {
			return { error: "Invalid time range" };
		}

		const preset = getTextStylePreset(style);
		const resolvedPosition = getTextPosition(position);
		const overridePosition =
			positionX !== undefined || positionY !== undefined
				? {
						x: positionX ?? resolvedPosition.x,
						y: positionY ?? resolvedPosition.y,
					}
				: resolvedPosition;

		const resolvedBackground = resolveBackground(preset.background, background);

		const element = buildTextElement({
			raw: {
				...preset,
				...(color !== undefined && { color }),
				...(fontSize !== undefined && { fontSize }),
				...(fontFamily !== undefined && { fontFamily }),
				...(fontWeight !== undefined && { fontWeight }),
				...(fontStyle !== undefined && { fontStyle }),
				...(textAlign !== undefined && { textAlign }),
				...(letterSpacing !== undefined && { letterSpacing }),
				background: resolvedBackground,
				name: text,
				content: text,
				duration,
				transform: {
					...DEFAULTS.text.element.transform,
					position: overridePosition,
				},
			},
			startTime: startTicks,
		});

		const insertCommand = new InsertElementCommand({
			element,
			placement: { mode: "auto", trackType: "text" },
		});
		core.command.execute({ command: insertCommand });

		const trackId = insertCommand.getTrackId();
		if (!trackId) {
			return { error: "Failed to add text" };
		}

		return {
			elementId: insertCommand.getElementId(),
			trackId,
		};
	},

	updateText({
		elementIds,
		content,
		color,
		fontSize,
		fontFamily,
		fontWeight,
		fontStyle,
		textAlign,
		letterSpacing,
		positionX,
		positionY,
		background,
	}: {
		elementIds: string[];
	} & Omit<UpdateTextArgs, "elementIds">):
		| {
				success: boolean;
				updated: Array<{ elementId: string; trackId: string }>;
				skipped: string[];
		  }
		| { error: string } {
		const core = EditorCore.getInstance();
		const activeScene = core.scenes.getActiveSceneOrNull();
		if (!activeScene) {
			return { error: "No active timeline" };
		}

		const resolved = findTimelineElementsWithTracksByIds({
			tracks: activeScene.tracks,
			elementIds,
		});

		const textElements = resolved.filter(
			({ element }) => element.type === "text",
		);
		const foundIds = new Set(textElements.map(({ element }) => element.id));
		const skipped = elementIds.filter((id) => !foundIds.has(id));

		if (textElements.length === 0) {
			return {
				success: false,
				updated: [],
				skipped,
			};
		}

		const updates: Array<{
			trackId: string;
			elementId: string;
			patch: Partial<TimelineElement>;
		}> = [];

		for (const { element, track } of textElements) {
			const patch = buildTextPatch(element, {
				content,
				color,
				fontSize,
				fontFamily,
				fontWeight,
				fontStyle,
				textAlign,
				letterSpacing,
				positionX,
				positionY,
				background,
			});
			updates.push({ trackId: track.id, elementId: element.id, patch });
		}

		core.timeline.updateElements({ updates });

		return {
			success: true,
			updated: updates.map((u) => ({
				elementId: u.elementId,
				trackId: u.trackId,
			})),
			skipped,
		};
	},

	addEffectElement({
		effectType,
		start,
		end,
		params,
	}: {
		effectType: string;
		start: number;
		end: number;
		params?: Record<string, number | string | boolean>;
	}):
		| {
				elementId: string;
				trackId: string;
				appliedParams: Record<string, number | string | boolean>;
		  }
		| { error: string } {
		const core = EditorCore.getInstance();
		const activeScene = core.scenes.getActiveSceneOrNull();
		if (!activeScene) {
			return { error: "No active timeline" };
		}

		if (!effectsRegistry.has(effectType)) {
			return { error: `Effect not found: ${effectType}` };
		}

		const definition = effectsRegistry.get(effectType);

		if (params) {
			const validationError = validateEffectParams(definition.params, params);
			if (validationError) {
				return { error: validationError };
			}
		}

		const startTimeTicks = secondsToTicks(start);
		const durationTicks = secondsToTicks(end) - startTimeTicks;
		if (durationTicks <= 0) {
			return { error: "Invalid time range" };
		}

		const element = buildEffectElement({
			effectType,
			startTime: startTimeTicks,
			duration: durationTicks,
		});

		if (params && Object.keys(params).length > 0) {
			element.params = { ...element.params, ...params };
		}

		const insertCommand = new InsertElementCommand({
			element,
			placement: { mode: "auto", trackType: "effect" },
		});
		core.command.execute({ command: insertCommand });

		const trackId = insertCommand.getTrackId();
		if (!trackId) {
			return { error: "Failed to place effect element" };
		}

		return {
			elementId: insertCommand.getElementId(),
			trackId,
			appliedParams: element.params,
		};
	},

	updateEffectElement({
		elementId,
		params,
	}: {
		elementId: string;
		params: Record<string, number | string | boolean>;
	}):
		| {
				success: boolean;
				elementId: string;
				appliedParams: Record<string, number | string | boolean>;
		  }
		| { error: string } {
		const core = EditorCore.getInstance();
		const activeScene = core.scenes.getActiveSceneOrNull();
		if (!activeScene) {
			return { error: "No active timeline" };
		}

		const [resolved] = findTimelineElementsWithTracksByIds({
			tracks: activeScene.tracks,
			elementIds: [elementId],
		});
		if (!resolved) {
			return { error: `Timeline element not found: ${elementId}` };
		}
		if (resolved.element.type !== "effect") {
			return { error: "Element is not an effect" };
		}

		const effectElement =
			resolved.element as import("@/lib/timeline/types").EffectElement;
		const definition = effectsRegistry.get(effectElement.effectType);
		if (!definition) {
			return { error: `Effect not found: ${effectElement.effectType}` };
		}

		const validationError = validateEffectParams(definition.params, params);
		if (validationError) {
			return { error: validationError };
		}

		const mergedParams = { ...effectElement.params, ...params };

		core.timeline.updateElements({
			updates: [
				{
					trackId: resolved.track.id,
					elementId,
					patch: { params: mergedParams } as Partial<
						import("@/lib/timeline/types").TimelineElement
					>,
				},
			],
		});

		return {
			success: true,
			elementId,
			appliedParams: mergedParams,
		};
	},

	getElement({
		elementId,
	}: {
		elementId: string;
	}): Record<string, unknown> | { error: string } {
		const core = EditorCore.getInstance();
		const activeScene = core.scenes.getActiveSceneOrNull();
		if (!activeScene) {
			return { error: "No active timeline" };
		}

		const [resolved] = findTimelineElementsWithTracksByIds({
			tracks: activeScene.tracks,
			elementIds: [elementId],
		});
		if (!resolved) {
			return { error: `Element not found: ${elementId}` };
		}

		return serializeElement(resolved.element, resolved.track.id);
	},

	updateClip({
		elementId,
		name,
		mask,
		opacity,
		positionX,
		positionY,
		rotation,
		scaleX,
		scaleY,
		blendMode,
		hidden,
		volume,
		muted,
	}: {
		elementId: string;
		name?: string;
		mask?: {
			action: "add" | "update" | "remove";
			maskType?: string;
			params?: Record<string, number | string | boolean>;
		};
		opacity?: number;
		positionX?: number;
		positionY?: number;
		rotation?: number;
		scaleX?: number;
		scaleY?: number;
		blendMode?: string;
		hidden?: boolean;
		volume?: number;
		muted?: boolean;
	}):
		| { success: boolean; elementId: string; applied: Record<string, unknown> }
		| { error: string } {
		const core = EditorCore.getInstance();
		const activeScene = core.scenes.getActiveSceneOrNull();
		if (!activeScene) {
			return { error: "No active timeline" };
		}

		const [resolved] = findTimelineElementsWithTracksByIds({
			tracks: activeScene.tracks,
			elementIds: [elementId],
		});
		if (!resolved) {
			return { error: `Timeline element not found: ${elementId}` };
		}

		const { element } = resolved;
		const patch: Record<string, unknown> = {};
		const applied: Record<string, unknown> = {};

		if (name !== undefined) {
			if (typeof name !== "string" || !name.trim()) {
				return { error: "name must be a non-empty string" };
			}
			patch.name = name;
			applied.name = name;
		}

		if (muted !== undefined) {
			if (typeof muted !== "boolean") {
				return { error: "muted must be a boolean" };
			}
			if (element.type !== "video" && element.type !== "audio") {
				return {
					error: `Element type '${element.type}' does not support muted`,
				};
			}
			patch.muted = muted;
			applied.muted = muted;
		}

		if (opacity !== undefined) {
			if (typeof opacity !== "number" || opacity < 0 || opacity > 100) {
				return { error: "opacity must be a number between 0 and 100" };
			}
			if (!hasProperty(element, "opacity")) {
				return {
					error: `Element type '${element.type}' does not support opacity`,
				};
			}
			patch.opacity = opacity;
			applied.opacity = opacity;
		}

		if (hidden !== undefined) {
			if (typeof hidden !== "boolean") {
				return { error: "hidden must be a boolean" };
			}
			patch.hidden = hidden;
			applied.hidden = hidden;
		}

		if (blendMode !== undefined) {
			if (typeof blendMode !== "string") {
				return { error: "blendMode must be a string" };
			}
			if (!hasProperty(element, "blendMode")) {
				return {
					error: `Element type '${element.type}' does not support blendMode`,
				};
			}
			patch.blendMode = blendMode as BlendMode;
			applied.blendMode = blendMode;
		}

		if (volume !== undefined) {
			if (typeof volume !== "number" || volume < 0 || volume > 100) {
				return { error: "volume must be a number between 0 and 100" };
			}
			if (element.type !== "video" && element.type !== "audio") {
				return {
					error: `Element type '${element.type}' does not support volume`,
				};
			}
			patch.volume = volume;
			applied.volume = volume;
		}

		if (
			positionX !== undefined ||
			positionY !== undefined ||
			rotation !== undefined ||
			scaleX !== undefined ||
			scaleY !== undefined
		) {
			if (!hasProperty(element, "transform")) {
				return {
					error: `Element type '${element.type}' does not support transform properties`,
				};
			}
			const currentTransform = (element as { transform: Transform }).transform;
			const nextTransform: Transform = {
				scaleX: scaleX ?? currentTransform.scaleX,
				scaleY: scaleY ?? currentTransform.scaleY,
				position: {
					x: positionX ?? currentTransform.position.x,
					y: positionY ?? currentTransform.position.y,
				},
				rotate: rotation ?? currentTransform.rotate,
			};
			patch.transform = nextTransform;
			applied.transform = nextTransform;
		}

		if (mask !== undefined) {
			if (!isMaskableElement(element)) {
				return {
					error: `Element type '${element.type}' does not support masks. Only video, image, and graphic elements support masks.`,
				};
			}

			const maskable = element as MaskableElement;
			const currentMasks = maskable.masks ?? [];

			if (mask.action === "add") {
				if (!mask.maskType || typeof mask.maskType !== "string") {
					return { error: "mask.maskType is required when action is 'add'" };
				}
				if (!masksRegistry.has(mask.maskType as MaskType)) {
					return {
						error: `Unknown mask type: ${mask.maskType}. Available: split, cinematic-bars, rectangle, ellipse, heart, diamond, star`,
					};
				}

				const newMask = buildDefaultMaskInstance({
					maskType: mask.maskType as MaskType,
				});
				if (mask.params) {
					newMask.params = { ...newMask.params, ...mask.params };
				}
				patch.masks = [...currentMasks, newMask];
				applied.mask = {
					id: newMask.id,
					type: newMask.type,
					params: newMask.params,
				};
			} else if (mask.action === "update") {
				if (currentMasks.length === 0) {
					return {
						error: `Element has no mask to update. Use action 'add' first.`,
					};
				}
				if (!mask.params || typeof mask.params !== "object") {
					return { error: "mask.params is required when action is 'update'" };
				}

				const existingMask = currentMasks[0];
				const updatedMasks = currentMasks.map((m, i) =>
					i === 0 ? { ...m, params: { ...m.params, ...mask.params } } : m,
				);
				patch.masks = updatedMasks;
				applied.mask = {
					type: existingMask.type,
					params: updatedMasks[0].params,
				};
			} else if (mask.action === "remove") {
				if (currentMasks.length === 0) {
					return { error: "Element has no mask to remove" };
				}
				patch.masks = [];
				applied.mask = null;
			}
		}

		if (Object.keys(patch).length === 0) {
			return {
				error: "No properties to update. Provide at least one property.",
			};
		}

		core.timeline.updateElements({
			updates: [
				{
					trackId: resolved.track.id,
					elementId,
					patch: patch as Partial<TimelineElement>,
				},
			],
		});

		return { success: true, elementId, applied };
	},
};

function secondsToTicks(seconds: number): number {
	return Math.round(seconds * TICKS_PER_SECOND);
}

function hasProperty(obj: unknown, prop: string): boolean {
	return typeof obj === "object" && obj !== null && prop in obj;
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

function getTextPosition(position: "top" | "center" | "bottom"): {
	x: number;
	y: number;
} {
	if (position === "top") {
		return { x: 0, y: -35 };
	}
	if (position === "bottom") {
		return { x: 0, y: 35 };
	}
	return { x: 0, y: 0 };
}

function resolveBackground(
	presetBackground: TextBackground | undefined,
	override: TextStyleOverrides["background"],
): TextBackground | undefined {
	if (!override) return presetBackground;
	const base = presetBackground ?? DEFAULTS.text.element.background;
	return {
		...base,
		enabled: override.enabled,
		...(override.color !== undefined && { color: override.color }),
		...(override.cornerRadius !== undefined && {
			cornerRadius: override.cornerRadius,
		}),
		...(override.padding !== undefined && {
			paddingX: override.padding,
			paddingY: override.padding,
		}),
	};
}

function getTextStylePreset(style: "plain" | "subtitle" | "hook" | "label") {
	const noBackground = {
		...DEFAULTS.text.element.background,
		enabled: false,
		color: "transparent",
	};

	if (style === "subtitle") {
		return {
			fontSize: 5,
			fontWeight: "bold" as const,
			background: {
				...DEFAULTS.text.element.background,
				enabled: true,
				color: "#000000",
			},
		};
	}
	if (style === "hook") {
		return {
			fontSize: 8,
			fontWeight: "bold" as const,
			background: noBackground,
		};
	}
	if (style === "label") {
		return {
			fontSize: 5,
			fontWeight: "bold" as const,
			background: {
				...DEFAULTS.text.element.background,
				enabled: true,
				color: "#000000",
			},
		};
	}
	return { fontSize: 6, background: noBackground };
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

function buildTextPatch(
	element: TimelineElement,
	overrides: Omit<UpdateTextArgs, "elementIds">,
): Partial<TimelineElement> {
	if (element.type !== "text") return {};

	const patch: Partial<TextElement> = {};

	if (overrides.content !== undefined) patch.content = overrides.content;
	if (overrides.color !== undefined) patch.color = overrides.color;
	if (overrides.fontSize !== undefined) patch.fontSize = overrides.fontSize;
	if (overrides.fontFamily !== undefined)
		patch.fontFamily = overrides.fontFamily;
	if (overrides.fontWeight !== undefined)
		patch.fontWeight = overrides.fontWeight;
	if (overrides.fontStyle !== undefined) patch.fontStyle = overrides.fontStyle;
	if (overrides.textAlign !== undefined) patch.textAlign = overrides.textAlign;
	if (overrides.letterSpacing !== undefined)
		patch.letterSpacing = overrides.letterSpacing;

	if (overrides.positionX !== undefined || overrides.positionY !== undefined) {
		const currentPos = element.transform.position;
		patch.transform = {
			...element.transform,
			position: {
				x: overrides.positionX ?? currentPos.x,
				y: overrides.positionY ?? currentPos.y,
			},
		};
	}

	if (overrides.background !== undefined) {
		const currentBg = element.background;
		patch.background = {
			...currentBg,
			enabled: overrides.background.enabled,
			...(overrides.background.color !== undefined && {
				color: overrides.background.color,
			}),
			...(overrides.background.cornerRadius !== undefined && {
				cornerRadius: overrides.background.cornerRadius,
			}),
			...(overrides.background.padding !== undefined && {
				paddingX: overrides.background.padding,
				paddingY: overrides.background.padding,
			}),
		};
	}

	return patch as Partial<TimelineElement>;
}

function validateEffectParams(
	paramDefs: import("@/lib/params").ParamDefinition[],
	params: Record<string, number | string | boolean>,
): string | null {
	for (const [key, value] of Object.entries(params)) {
		const def = paramDefs.find((p) => p.key === key);
		if (!def) {
			return `Unknown parameter: ${key}`;
		}

		if (def.type === "number") {
			if (typeof value !== "number") {
				return `Parameter '${key}' must be a number`;
			}
			if (def.min !== undefined && value < def.min) {
				return `Parameter '${key}' must be >= ${def.min}`;
			}
			if (def.max !== undefined && value > def.max) {
				return `Parameter '${key}' must be <= ${def.max}`;
			}
		}

		if (def.type === "boolean" && typeof value !== "boolean") {
			return `Parameter '${key}' must be a boolean`;
		}

		if (def.type === "color" && typeof value !== "string") {
			return `Parameter '${key}' must be a string (hex color)`;
		}

		if (def.type === "select") {
			if (typeof value !== "string") {
				return `Parameter '${key}' must be a string`;
			}
			const validValues = def.options.map((o) => o.value);
			if (!validValues.includes(value)) {
				return `Parameter '${key}' must be one of: ${validValues.join(", ")}`;
			}
		}
	}
	return null;
}

export { buildSystemPrompt } from "@/agent/system-prompt";

function serializeElement(
	element: TimelineElement,
	trackId: string,
): Record<string, unknown> {
	const base = {
		elementId: element.id,
		trackId,
		type: element.type,
		name: element.name,
		start: ticksToSeconds(element.startTime),
		end: ticksToSeconds(element.startTime + element.duration),
		duration: ticksToSeconds(element.duration),
		trimStart: ticksToSeconds(element.trimStart),
		trimEnd: ticksToSeconds(element.trimEnd),
	};

	switch (element.type) {
		case "video":
			return {
				...base,
				assetId: element.mediaId,
				transform: element.transform,
				opacity: element.opacity,
				blendMode: element.blendMode ?? null,
				hidden: element.hidden ?? false,
				volume: element.volume ?? 100,
				muted: element.muted ?? false,
				masks: element.masks ?? [],
				effects: element.effects ?? [],
			};
		case "image":
			return {
				...base,
				assetId: element.mediaId,
				transform: element.transform,
				opacity: element.opacity,
				blendMode: element.blendMode ?? null,
				hidden: element.hidden ?? false,
				masks: element.masks ?? [],
				effects: element.effects ?? [],
			};
		case "text":
			return {
				...base,
				content: element.content,
				fontSize: element.fontSize,
				fontFamily: element.fontFamily,
				color: element.color,
				fontWeight: element.fontWeight,
				fontStyle: element.fontStyle,
				textAlign: element.textAlign,
				letterSpacing: element.letterSpacing ?? null,
				lineHeight: element.lineHeight ?? null,
				background: element.background,
				transform: element.transform,
				opacity: element.opacity,
				blendMode: element.blendMode ?? null,
				hidden: element.hidden ?? false,
				effects: element.effects ?? [],
			};
		case "sticker":
			return {
				...base,
				stickerId: element.stickerId,
				transform: element.transform,
				opacity: element.opacity,
				blendMode: element.blendMode ?? null,
				hidden: element.hidden ?? false,
				effects: element.effects ?? [],
			};
		case "graphic":
			return {
				...base,
				definitionId: element.definitionId,
				params: element.params,
				transform: element.transform,
				opacity: element.opacity,
				blendMode: element.blendMode ?? null,
				hidden: element.hidden ?? false,
				masks: element.masks ?? [],
				effects: element.effects ?? [],
			};
		case "audio":
			return {
				...base,
				assetId: element.sourceType === "upload" ? element.mediaId : null,
				sourceType: element.sourceType,
				volume: element.volume,
				muted: element.muted ?? false,
			};
		case "effect":
			return {
				...base,
				effectType: element.effectType,
				params: element.params,
			};
		default:
			return base;
	}
}
