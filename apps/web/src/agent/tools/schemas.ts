import type { ToolSchema } from "@/agent/types";

/**
 * Single source of truth for agent tool schemas.
 *
 * Both the server route (provider-facing schema list) and the client tool
 * definitions (`*.tool.ts`) import from here. This guarantees that the
 * description and parameters the model sees are exactly what the executor
 * validates against — no drift possible.
 *
 * Pure data: no side effects, no EditorCore imports. Safe for server use.
 */

export const loadContextSchema: ToolSchema = {
	name: "load_context",
	description:
		"Loads the actual Gemini multimodal context for a project asset or timeline element. Use this before answering questions about visible objects, colors, scenes, speech, silence, or timestamps in media. Use targetType='asset' with assetId/id for media, or targetType='timeline_element' with trackId and elementId/id for captions, text, or timeline media elements.",
	parameters: [
		{ key: "targetType", type: "string", required: true },
		{ key: "id", type: "string", required: false },
		{ key: "assetId", type: "string", required: false },
		{ key: "trackId", type: "string", required: false },
		{ key: "elementId", type: "string", required: false },
	],
};

export const listProjectAssetsSchema: ToolSchema = {
	name: "list_project_assets",
	description:
		"Lists project media assets with stable ids, type, duration, and whether each asset is used in the active timeline.",
	parameters: [
		{ key: "filter", type: "string", required: false },
		{ key: "type", type: "string", required: false },
	],
};

export const listTimelineSchema: ToolSchema = {
	name: "list_timeline",
	description:
		"Lists the active timeline as structured tracks and editable elements with layer metadata. Element start/end values are in seconds. Tracks include position (top-to-bottom timeline row), visualLayer (higher renders above lower, null for audio), isVisualLayer, and stacking. Use this to understand which clips visually cover others and to discover ids before load_context.",
	parameters: [],
};

export const splitSchema: ToolSchema = {
	name: "split",
	description:
		"Splits timeline elements at one or more requested timeline times in seconds without deleting, trimming, or moving content. Use one time for a single cut, or multiple times to isolate ranges before separate edit/delete operations.",
	parameters: [{ key: "times", type: "number[]", required: true }],
};

export const deleteTimelineElementsSchema: ToolSchema = {
	name: "delete_timeline_elements",
	description:
		"Deletes one or more timeline elements by elementId. Use list_timeline first to discover exact elementIds. To delete a time range, split at the range boundaries first, then delete the isolated elementIds.",
	parameters: [{ key: "elementIds", type: "string[]", required: true }],
};

export const moveTimelineElementsSchema: ToolSchema = {
	name: "move_timeline_elements",
	description:
		"Moves one or more existing timeline elements to a new timeline start time in seconds. For multiple elements, the earliest selected element is moved to start and the others preserve their relative offsets. Optionally pass targetTrackId to move them to another compatible track.",
	parameters: [
		{ key: "elementIds", type: "string[]", required: true },
		{ key: "start", type: "number", required: true },
		{ key: "targetTrackId", type: "string", required: false },
	],
};

export const addMediaToTimelineSchema: ToolSchema = {
	name: "add_media_to_timeline",
	description:
		"Adds an existing project media asset to the active timeline. Use list_project_assets first to discover assetId. startTime and optional duration are in timeline seconds. trackType must be main, overlay, or audio.",
	parameters: [
		{ key: "assetId", type: "string", required: true },
		{ key: "startTime", type: "number", required: true },
		{ key: "trackType", type: "string", required: true },
		{ key: "duration", type: "number", required: false },
	],
};

export const updateTimelineElementTimingSchema: ToolSchema = {
	name: "update_timeline_element_timing",
	description:
		"Updates an existing timeline element's timing. Use list_timeline first to discover elementId. start, end, and duration are timeline seconds; pass at least one of start, end, or duration.",
	parameters: [
		{ key: "elementId", type: "string", required: true },
		{ key: "start", type: "number", required: false },
		{ key: "end", type: "number", required: false },
		{ key: "duration", type: "number", required: false },
	],
};

export const addTextSchema: ToolSchema = {
	name: "add_text",
	description:
		"Adds visual text to the active timeline. Use for titles, hooks, labels, and simple subtitle blocks. start and end are timeline seconds. position must be top, center, or bottom; style may be plain, subtitle, hook, or label. Override style defaults with color (hex), fontSize (scaled units), fontFamily, fontWeight (normal/bold), fontStyle (normal/italic), textAlign (left/center/right), letterSpacing, positionX/positionY (offset from -50 to 50), or background ({ enabled, color?, cornerRadius?, padding? }).",
	parameters: [
		{ key: "text", type: "string", required: true },
		{ key: "start", type: "number", required: true },
		{ key: "end", type: "number", required: true },
		{ key: "position", type: "string", required: true },
		{ key: "style", type: "string", required: false },
		{ key: "color", type: "string", required: false },
		{ key: "fontSize", type: "number", required: false },
		{ key: "fontFamily", type: "string", required: false },
		{ key: "fontWeight", type: "string", required: false },
		{ key: "fontStyle", type: "string", required: false },
		{ key: "textAlign", type: "string", required: false },
		{ key: "letterSpacing", type: "number", required: false },
		{ key: "positionX", type: "number", required: false },
		{ key: "positionY", type: "number", required: false },
		{ key: "background", type: "object", required: false },
	],
};

export const updateTextSchema: ToolSchema = {
	name: "update_text",
	description:
		"Updates visual properties of existing text elements. Pass elementIds (from list_timeline) and any combination of text style overrides. Only text elements are updated; non-text elements are skipped. All listed text elements receive the same overrides — use for bulk styling subtitle blocks.",
	parameters: [
		// "array" (not "string[]") so the orchestrator validator stays
		// tolerant of CSV-string fallback handled by resolveElementIds.
		{ key: "elementIds", type: "array", required: true },
		{ key: "content", type: "string", required: false },
		{ key: "color", type: "string", required: false },
		{ key: "fontSize", type: "number", required: false },
		{ key: "fontFamily", type: "string", required: false },
		{ key: "fontWeight", type: "string", required: false },
		{ key: "fontStyle", type: "string", required: false },
		{ key: "textAlign", type: "string", required: false },
		{ key: "letterSpacing", type: "number", required: false },
		{ key: "positionX", type: "number", required: false },
		{ key: "positionY", type: "number", required: false },
		{ key: "background", type: "object", required: false },
	],
};

export const listEffectsSchema: ToolSchema = {
	name: "list_effects",
	description:
		"Lists all available effects that can be applied to visual timeline elements. Returns each effect's id, name, and description of what it does. Use this to discover effects before calling get_effect for parameter details.",
	parameters: [{ key: "query", type: "string", required: false }],
};

export const getEffectSchema: ToolSchema = {
	name: "get_effect",
	description:
		"Returns detailed metadata for a specific effect, including all configurable parameters with their types, ranges, defaults, and descriptions. Use this after list_effects to understand how to configure an effect before calling apply_effect.",
	parameters: [{ key: "effectType", type: "string", required: true }],
};

export const applyEffectSchema: ToolSchema = {
	name: "apply_effect",
	description:
		"Adds an effect element to the timeline on an effect track, like dragging an effect from the effects panel. The effect covers the time range from start to end (in seconds). Use list_effects to discover available effects, get_effect to learn their parameters, then apply_effect with the desired params. Default parameter values are used when params are omitted.",
	parameters: [
		{ key: "effectType", type: "string", required: true },
		{ key: "start", type: "number", required: true },
		{ key: "end", type: "number", required: true },
		{ key: "params", type: "object", required: false },
	],
};

export const updateEffectSchema: ToolSchema = {
	name: "update_effect",
	description:
		"Updates parameters of an existing effect element on the timeline. Use list_timeline to find the elementId of the effect, then pass the params you want to change. Only the provided parameters are updated; others keep their current values. Use get_effect to discover valid parameter keys and ranges.",
	parameters: [
		{ key: "elementId", type: "string", required: true },
		{ key: "params", type: "object", required: true },
	],
};

export const getElementSchema: ToolSchema = {
	name: "get_element",
	description:
		"Returns full metadata for a single timeline element. Use list_timeline to discover elementIds, then get_element for deep inspection. Returns type-specific properties: video/image/graphic elements include transform, opacity, blendMode, masks, hidden, and applied effects. Text elements include content, font styles, background, transform. Audio elements include volume, muted. Effect elements include effectType and all parameter values.",
	parameters: [{ key: "elementId", type: "string", required: true }],
};

export const updateClipSchema: ToolSchema = {
	name: "update_clip",
	description:
		"Updates properties of any timeline element (video, image, graphic, text, sticker, audio, effect). Use list_timeline to discover elementId, then get_element to inspect current values. Only provide the properties you want to change. mask: { action: 'add', maskType } to add, { action: 'update', params: {...} } to modify, { action: 'remove' } to delete. Mask types: rectangle, ellipse, heart, diamond, star, split, cinematic-bars. Only video/image/graphic support masks. name: rename the element. opacity: 0-100. positionX/positionY: position offset. rotation: degrees. scaleX/scaleY: scale factor. blendMode: normal, darken, multiply, screen, etc. hidden: boolean. volume: 0-100 (video/audio only). muted: boolean (video/audio only).",
	parameters: [
		{ key: "elementId", type: "string", required: true },
		{ key: "name", type: "string", required: false },
		{ key: "mask", type: "object", required: false },
		{ key: "opacity", type: "number", required: false },
		{ key: "positionX", type: "number", required: false },
		{ key: "positionY", type: "number", required: false },
		{ key: "rotation", type: "number", required: false },
		{ key: "scaleX", type: "number", required: false },
		{ key: "scaleY", type: "number", required: false },
		{ key: "blendMode", type: "string", required: false },
		{ key: "hidden", type: "boolean", required: false },
		{ key: "volume", type: "number", required: false },
		{ key: "muted", type: "boolean", required: false },
	],
};

/**
 * The exact list of schemas exposed to the LLM.
 * Excludes internal-only tools (transcribe_video, mock).
 */
export const providerToolSchemas: ToolSchema[] = [
	loadContextSchema,
	listProjectAssetsSchema,
	listTimelineSchema,
	getElementSchema,
	splitSchema,
	deleteTimelineElementsSchema,
	moveTimelineElementsSchema,
	addMediaToTimelineSchema,
	updateTimelineElementTimingSchema,
	addTextSchema,
	updateTextSchema,
	listEffectsSchema,
	getEffectSchema,
	applyEffectSchema,
	updateEffectSchema,
	updateClipSchema,
];
