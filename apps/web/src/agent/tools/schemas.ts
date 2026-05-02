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
		"Loads Gemini multimodal context for a project asset or timeline element. Prefer human-readable targets from list_timeline/list_project_assets: asset names like 'intro.mov' or element refs like 'clip-1'/'text-3'. For media: targetType='asset' with assetId or id. For timeline elements: targetType='timeline_element' with elementId or id. trackId is not needed.",
	parameters: [
		{
			key: "targetType",
			type: "string",
			required: true,
			description:
				"What to load: project asset media context or timeline element context.",
			enum: ["asset", "timeline_element"],
		},
		{
			key: "id",
			type: "string",
			required: false,
			description:
				"Asset name/id or element ref/id. Prefer list_timeline refs like 'clip-1' and asset names like 'intro.mov'.",
		},
		{
			key: "assetId",
			type: "string",
			required: false,
			description:
				"Asset id or asset name. Prefer asset names unless an ambiguity error asks for an id.",
		},
		{
			key: "elementId",
			type: "string",
			required: false,
			description:
				"Timeline element id or human ref from list_timeline, e.g. 'clip-1' or 'text-3'.",
		},
	],
	returns:
		"On success: { targetType, id, status: 'loaded'|'processing', cached: boolean, provider: 'gemini', context }. For assets, context is { kind: 'media', assetId, assetName, assetType, duration, fileUri, mimeType }. For text elements, context is { kind: 'text', trackId, elementId, type, content, start, end }. For media elements, context includes both media fields and an element sub-object. On error: { error: string }.",
	notes: "Media context is uploaded to Gemini File API and injected into the conversation automatically — you can then answer visual/audio questions about it. Text context is cached locally. Supports image, video, and audio assets only. For broad multimodal understanding use this tool; for precise word-level timing use transcribe_audio instead.",
};

export const transcribeAudioSchema: ToolSchema = {
	name: "transcribe_audio",
	description:
		"Transcribes a video or audio asset with precise word-level timing. Returns full text, per-word start/end times, confidence scores, and utterance segments. Use this when you need exact spoken words, timestamps for subtitles, or silence detection. Pass assetId as an asset name or id, or omit it only when there is one video/audio asset.",
	parameters: [
		{
			key: "assetId",
			type: "string",
			required: false,
			description:
				"Asset name or id. Prefer names from list_project_assets, e.g. 'interview.wav'.",
		},
		{
			key: "language",
			type: "string",
			required: false,
			description:
				"Optional spoken language hint. Use 'auto' or omit when unknown.",
		},
	],
	returns:
		"On success: { transcriptId, assetId, assetName, provider: 'deepgram', language, fullText, duration, timingGranularity: 'word', wordCount, utteranceCount, words: Array<{text, start, end, confidence?}>, utterances: Array<{text, start, end, confidence?, speaker?, words[]}>, segments: Array<{text, start, end}> }. On error: { error: string }.",
	notes: "Returns precise word-level timing — use for subtitle timing, silence detection, and audio-driven edit points. If assetId is omitted and there is exactly one video/audio asset, it auto-selects. If multiple assets exist, you must specify which one. Asset must have an audio track (images will error).",
};

export const listProjectAssetsSchema: ToolSchema = {
	name: "list_project_assets",
	description:
		"Lists project media assets with stable ids, type, duration, and whether each asset is used in the active timeline.",
	parameters: [
		{ key: "filter", type: "string", required: false, description: "Filter by usage: 'all', 'used', or 'unused'. Default: 'all'." },
		{ key: "type", type: "string", required: false, description: "Filter by type: 'all', 'video', 'audio', or 'image'. Default: 'all'." },
	],
	returns:
		"On success: { assets: Array<{id, name, type: 'video'|'audio'|'image', duration?: number, usedInTimeline: boolean}> }. On error: { error: string }.",
	notes: "Always call this before add_media_to_timeline or load_context to discover asset IDs. The id field is the internal ID needed by other tools. duration is omitted for images.",
};

export const listTimelineSchema: ToolSchema = {
	name: "list_timeline",
	description:
		"Lists the active timeline as structured tracks and editable elements with layer metadata. Element start/end values are in seconds. Tracks include position (top-to-bottom timeline row), visualLayer (higher renders above lower, null for audio), isVisualLayer, and stacking. Use this to understand which clips visually cover others and to discover ids before load_context.",
	parameters: [],
	returns:
		"On success: { tracks: AgentTimelineTrack[] }. Each track has: trackId, trackRef, trackLabel, type ('main'|'overlay'|'audio'|'text'|'effect'), position, visualLayer, isVisualLayer, stacking. Each track.elements[] has: elementId, ref, type, assetId?, assetName?, name?, content?, duration, start, end, hasMask?, hasEffects?, isHidden?. On error: { error: string }.",
	notes: "Always call this first before editing to discover element refs. Element refs (like 'clip-1', 'text-3') are stable within a session but change after split/delete operations — call again after write operations to get updated refs. start/end are in seconds. The ref field is the preferred way to reference elements in other tools.",
};

export const splitSchema: ToolSchema = {
	name: "split",
	description:
		"Splits timeline elements at one or more requested timeline times in seconds without deleting, trimming, or moving content. Use one time for a single cut, or multiple times to isolate ranges before separate edit/delete operations. When no target is specified, all elements intersecting the given times are split. Pass a target to restrict the split to a specific element.",
	parameters: [
		{
			key: "times",
			type: "number[]",
			required: true,
			description:
				"Timeline times in seconds where splits should occur. Multiple times create multiple cuts.",
		},
		{
			key: "target",
			type: "string",
			required: false,
			description:
				"Optional element ref or id to restrict the split to. Prefer refs from list_timeline like 'clip-1'. When omitted, all elements at the given times are split.",
		},
	],
	returns:
		"On success: { success: true, affectedElements: string[] }. affectedElements contains the IDs of all elements that were split. On error: { error: string }.",
	notes: "Split does NOT delete or move content — it creates new elements at the split points. After splitting, call list_timeline to discover the new element refs (the original ref may now point to a different fragment). Times must be non-negative finite numbers. Splitting at a time where no element exists is a no-op for that time.",
};

export const deleteTimelineElementsSchema: ToolSchema = {
	name: "delete_timeline_elements",
	description:
		"Deletes one or more timeline elements. Prefer targets with human refs from list_timeline, e.g. ['clip-1', 'text-3']. To delete a time range, split at the range boundaries first, then delete the isolated refs.",
	parameters: [
		{
			key: "targets",
			type: "array",
			required: true,
			aliases: ["elementIds"],
			description:
				"Element refs or ids to delete. Prefer refs like 'clip-1' or 'text-3'.",
			items: { key: "target", type: "string", required: true },
		},
		{
			key: "elementIds",
			type: "string[]",
			required: false,
			description: "Legacy fallback. Prefer targets.",
		},
	],
	returns:
		"On success: { success: true, deletedElements: string[] }. deletedElements lists the IDs that were removed. On error: { error: string }.",
	notes: "To delete a time range: first split at the range boundaries, then delete the isolated elements. Accepts refs (preferred) or raw IDs. After deletion, call list_timeline to see the updated state.",
};

export const moveTimelineElementsSchema: ToolSchema = {
	name: "move_timeline_elements",
	description:
		"Moves one or more existing timeline elements to a new timeline start time in seconds. Prefer targets with refs from list_timeline. For multiple elements, the earliest selected element is moved to start and the others preserve their relative offsets. Optionally pass targetTrackRef to move them to another compatible track.",
	parameters: [
		{
			key: "targets",
			type: "array",
			required: true,
			aliases: ["elementIds"],
			description:
				"Element refs or ids to move. Prefer refs like 'clip-1' or 'text-3'.",
			items: { key: "target", type: "string", required: true },
		},
		{
			key: "start",
			type: "number",
			required: true,
			description: "New timeline start in seconds.",
		},
		{
			key: "targetTrackRef",
			type: "string",
			required: false,
			description:
				"Target track ref/id/label from list_timeline, e.g. 'main-1' or 'overlay-1'.",
		},
		{
			key: "elementIds",
			type: "string[]",
			required: false,
			description: "Legacy fallback. Prefer targets.",
		},
		{
			key: "targetTrackId",
			type: "string",
			required: false,
			description: "Legacy fallback. Prefer targetTrackRef.",
		},
	],
	returns:
		"On success: { success: true, movedElements: Array<{elementId, trackId, start, end}> }. Each element shows its new position. On error: { error: string }.",
	notes: "For multiple elements, the earliest element is placed at 'start' and others keep their relative offsets. Elements must be compatible with the target track type (e.g. cannot move video to audio track). Use list_timeline to discover track refs and verify compatibility.",
};

export const addMediaToTimelineSchema: ToolSchema = {
	name: "add_media_to_timeline",
	description:
		"Adds an existing project media asset to the active timeline. Use list_project_assets first to discover assetId. startTime and optional duration are in timeline seconds. trackType must be main, overlay, or audio.",
	parameters: [
		{ key: "assetId", type: "string", required: true, description: "Internal asset id from list_project_assets (e.g. 'v1'), NOT the filename." },
		{ key: "startTime", type: "number", required: true, description: "Timeline start position in seconds. Must be >= 0." },
		{ key: "trackType", type: "string", required: true, description: "'main' or 'overlay' for video/image assets, 'audio' for audio assets." },
		{ key: "duration", type: "number", required: false, description: "Duration in seconds. Defaults to full asset duration. For video/audio, cannot exceed source duration." },
	],
	returns:
		"On success: { elementId, trackId }. On error: { error: string }.",
	notes: "trackType 'main'/'overlay' only accepts video/image assets; 'audio' only accepts audio assets. If omitted, duration defaults to the asset's full duration. A new track is created automatically if no compatible track has space. Always call list_project_assets first to get the correct internal assetId.",
};

export const updateTimelineElementTimingSchema: ToolSchema = {
	name: "update_timeline_element_timing",
	description:
		"Updates an existing timeline element's timing. Use list_timeline first to discover elementId. start, end, and duration are timeline seconds; pass at least one of start, end, or duration.",
	parameters: [
		{ key: "elementId", type: "string", required: true, description: "Element id from list_timeline." },
		{ key: "start", type: "number", required: false, description: "New start time in seconds." },
		{ key: "end", type: "number", required: false, description: "New end time in seconds." },
		{ key: "duration", type: "number", required: false, description: "New duration in seconds." },
	],
	returns:
		"On success: { success: true, elementId, trackId, start, end, duration }. On error: { error: string }.",
	notes: "Must provide at least one of start, end, or duration. Providing both end and duration must be consistent (end = start + duration). For video/audio, duration cannot exceed source duration minus trims. Does NOT accept refs — use the elementId field from list_timeline.",
};

export const addTextSchema: ToolSchema = {
	name: "add_text",
	description:
		"Adds visual text to the active timeline. start and end are seconds. position must be exactly one of: 'top', 'center', or 'bottom'. style: 'plain', 'subtitle' (white on black bg), 'hook' (large bold), or 'label'. Override defaults with color (hex), fontSize, fontFamily, fontWeight, fontStyle, textAlign, letterSpacing, positionX/positionY (-50 to 50), or background.",
	parameters: [
		{ key: "text", type: "string", required: true, description: "Text content. Must be non-empty." },
		{ key: "start", type: "number", required: true, description: "Start time in seconds. Must be >= 0." },
		{ key: "end", type: "number", required: true, description: "End time in seconds. Must be > start." },
		{
			key: "position",
			type: "string",
			required: true,
			enum: ["top", "center", "bottom"],
			description: "Vertical preset: 'top' (y:-35), 'center' (y:0), 'bottom' (y:35).",
		},
		{
			key: "style",
			type: "string",
			required: false,
			enum: ["plain", "subtitle", "hook", "label"],
			description: "Style preset. 'plain': fontSize 6, no bg. 'subtitle': fontSize 5, bold, black bg. 'hook': fontSize 8, bold, no bg. 'label': fontSize 5, bold, black bg.",
		},
		{ key: "color", type: "string", required: false, description: "Text color as hex string, e.g. '#FFFFFF'." },
		{ key: "fontSize", type: "number", required: false, description: "Font size. Must be > 0." },
		{ key: "fontFamily", type: "string", required: false, description: "Font family name." },
		{
			key: "fontWeight",
			type: "string",
			required: false,
			enum: ["normal", "bold"],
			description: "Font weight.",
		},
		{
			key: "fontStyle",
			type: "string",
			required: false,
			enum: ["normal", "italic"],
			description: "Font style.",
		},
		{
			key: "textAlign",
			type: "string",
			required: false,
			enum: ["left", "center", "right"],
			description: "Text alignment.",
		},
		{ key: "letterSpacing", type: "number", required: false, description: "Letter spacing." },
		{ key: "positionX", type: "number", required: false, description: "Fine-tune X position (-50 to 50). Overrides position preset's X." },
		{ key: "positionY", type: "number", required: false, description: "Fine-tune Y position (-50 to 50). Overrides position preset's Y." },
		{ key: "background", type: "object", required: false, description: "Background: { enabled: boolean, color?: string, cornerRadius?: number, padding?: number }." },
	],
	returns:
		"On success: { elementId, trackId }. On error: { error: string }.",
	notes: "Creates a text element on an auto-created text track. Style presets set fontSize, fontWeight, and background defaults — override them with individual parameters. Use positionX/positionY for fine-tuning beyond the three position presets. For subtitles, use style 'subtitle' with position 'bottom'.",
};

export const updateTextSchema: ToolSchema = {
	name: "update_text",
	description:
		"Updates visual properties of existing text elements. Prefer targets with refs from list_timeline, e.g. ['text-1']. All listed elements receive the same overrides — use for bulk styling. Non-text elements in the list are skipped.",
	parameters: [
		{
			key: "targets",
			type: "array",
			required: true,
			aliases: ["elementIds"],
			description: "Text element refs or ids. Prefer refs like 'text-1'.",
			items: { key: "target", type: "string", required: true },
		},
		{
			key: "elementIds",
			type: "array",
			required: false,
			description: "Legacy fallback. Prefer targets.",
		},
		{ key: "content", type: "string", required: false, description: "New text content. Must be non-empty if provided." },
		{ key: "color", type: "string", required: false, description: "Text color as hex string." },
		{ key: "fontSize", type: "number", required: false, description: "Font size. Must be > 0." },
		{ key: "fontFamily", type: "string", required: false, description: "Font family name." },
		{
			key: "fontWeight",
			type: "string",
			required: false,
			enum: ["normal", "bold"],
		},
		{
			key: "fontStyle",
			type: "string",
			required: false,
			enum: ["normal", "italic"],
		},
		{
			key: "textAlign",
			type: "string",
			required: false,
			enum: ["left", "center", "right"],
		},
		{ key: "letterSpacing", type: "number", required: false },
		{ key: "positionX", type: "number", required: false, description: "X position offset (-50 to 50)." },
		{ key: "positionY", type: "number", required: false, description: "Y position offset (-50 to 50)." },
		{ key: "background", type: "object", required: false, description: "Background: { enabled: boolean, color?: string, cornerRadius?: number, padding?: number }." },
	],
	returns:
		"On success: { success: true, updated: Array<{elementId, trackId}>, skipped: string[] }. Non-text elements in targets are skipped and listed. On error: { error: string }.",
	notes: "All listed elements receive the same overrides (bulk styling). Non-text elements are silently skipped — check the skipped array. Only the properties you provide are changed; others keep their current values.",
};

export const listEffectsSchema: ToolSchema = {
	name: "list_effects",
	description:
		"Lists all available effects that can be applied to visual timeline elements. Returns each effect's id, name, and description of what it does. Use this to discover effects before calling get_effect for parameter details.",
	parameters: [{ key: "query", type: "string", required: false, description: "Optional search query to filter effects by name or description." }],
	returns:
		"On success: array of { id, name, description }. On error: { error: string }.",
	notes: "Use this to discover available effects, then get_effect for parameter details, then apply_effect to use them.",
};

export const getEffectSchema: ToolSchema = {
	name: "get_effect",
	description:
		"Returns detailed metadata for a specific effect, including all configurable parameters with their types, ranges, defaults, and descriptions. Use this after list_effects to understand how to configure an effect before calling apply_effect.",
	parameters: [{ key: "effectType", type: "string", required: true, description: "Effect id from list_effects." }],
	returns:
		"On success: parameter definitions array with { key, type ('number'|'boolean'|'color'|'select'), min?, max?, default, description, options? for select type }. On error: { error: string }.",
	notes: "Always call this before apply_effect to understand valid parameter keys, types, and ranges. Default values are used for any params omitted in apply_effect.",
};

export const applyEffectSchema: ToolSchema = {
	name: "apply_effect",
	description:
		"Adds an effect element to the timeline on an effect track, like dragging an effect from the effects panel. The effect covers the time range from start to end (in seconds). Use list_effects to discover available effects, get_effect to learn their parameters, then apply_effect with the desired params. Default parameter values are used when params are omitted.",
	parameters: [
		{ key: "effectType", type: "string", required: true, description: "Effect id from list_effects." },
		{ key: "start", type: "number", required: true, description: "Start time in seconds. Must be >= 0." },
		{ key: "end", type: "number", required: true, description: "End time in seconds. Must be > start." },
		{ key: "params", type: "object", required: false, description: "Effect parameters as key-value pairs. Use get_effect to discover valid keys, types, and ranges." },
	],
	returns:
		"On success: { elementId, trackId, appliedParams: Record<string, number|string|boolean> }. appliedParams shows all parameter values after defaults are merged. On error: { error: string }.",
	notes: "Creates an effect element on an effect track. The effect applies to all visual elements that overlap its time range. Default parameter values are used for any omitted params. Use get_effect first to discover valid parameter keys and ranges.",
};

export const updateEffectSchema: ToolSchema = {
	name: "update_effect",
	description:
		"Updates parameters of an existing effect element on the timeline. Use list_timeline to find the elementId of the effect, then pass the params you want to change. Only the provided parameters are updated; others keep their current values. Use get_effect to discover valid parameter keys and ranges.",
	parameters: [
		{ key: "elementId", type: "string", required: true, description: "Effect element id from list_timeline." },
		{ key: "params", type: "object", required: true, description: "Parameters to update as key-value pairs. At least one parameter required." },
	],
	returns:
		"On success: { success: true, elementId, appliedParams: Record<string, number|string|boolean> }. appliedParams shows all parameter values after the merge. On error: { error: string }.",
	notes: "Only the provided parameters are updated; others keep their current values. The element must be an effect type. Use get_effect to discover valid parameter keys and ranges. Use list_timeline to find the effect elementId.",
};

export const redoSchema: ToolSchema = {
	name: "redo",
	description:
		"Redoes the last undone action. Only works after an undo. Returns whether there are more actions to redo.",
	parameters: [],
	returns:
		"On success: { remainingRedoDepth: number }. On error: { error: string } (e.g. 'Nothing to redo').",
	notes: "Only works after an undo. Consecutive calls redo more actions. remainingRedoDepth indicates if more redos are available.",
};

export const toggleTrackMuteSchema: ToolSchema = {
	name: "toggle_track_mute",
	description:
		"Toggles mute on a timeline track. Use list_timeline to discover trackIds. Only works on tracks that support audio (video and audio tracks). Returns the new muted state.",
	parameters: [{ key: "trackId", type: "string", required: true, description: "Track id from list_timeline." }],
	returns:
		"On success: { trackId: string }. On error: { error: string }.",
	notes: "Toggles the current mute state (on to off, off to on). The new state can be inferred by reading the track from list_timeline after the call. Only works on tracks with audio capability.",
};

export const toggleTrackVisibilitySchema: ToolSchema = {
	name: "toggle_track_visibility",
	description:
		"Toggles visibility on a timeline track. Hidden tracks are not rendered in the preview. Use list_timeline to discover trackIds. Returns the new hidden state.",
	parameters: [{ key: "trackId", type: "string", required: true, description: "Track id from list_timeline." }],
	returns:
		"On success: { trackId: string }. On error: { error: string }.",
	notes: "Hidden tracks are not rendered in preview or export. Toggles the current visibility state. The new state can be inferred from list_timeline after the call.",
};

export const undoSchema: ToolSchema = {
	name: "undo",
	description:
		"Undoes the last editing action performed by any tool. Use this to revert mistakes. Returns the remaining undo stack depth. Consecutive calls undo earlier actions.",
	parameters: [],
	returns:
		"On success: { remainingUndoDepth: number }. On error: { error: string } (e.g. 'Nothing to undo').",
	notes: "Consecutive calls undo earlier actions. remainingUndoDepth is 0 when no more undos are available.",
};

export const duplicateElementsSchema: ToolSchema = {
	name: "duplicate_elements",
	description:
		"Duplicates one or more timeline elements. The copies are placed on new tracks above the originals. Use list_timeline to discover elementIds first.",
	parameters: [{ key: "elementIds", type: "string[]", required: true, description: "Element ids to duplicate. Use elementId from list_timeline (not refs)." }],
	returns:
		"On success: { success: true, duplicated: Array<{elementId, trackId}> }. On error: { error: string }.",
	notes: "Copies are placed on new tracks above the originals. Accepts element IDs (not refs). Duplicated elements get new IDs — call list_timeline to discover them.",
};

export const getElementSchema: ToolSchema = {
	name: "get_element",
	description:
		"Returns full metadata for a single timeline element. Prefer target with a human ref from list_timeline, e.g. 'clip-1' or 'text-3'. Returns type-specific properties: video/image/graphic elements include transform, opacity, blendMode, masks, hidden, and applied effects. Text elements include content, font styles, background, transform. Audio elements include volume, muted. Effect elements include effectType and all parameter values.",
	parameters: [
		{
			key: "target",
			type: "string",
			required: true,
			aliases: ["elementId"],
			description:
				"Timeline element ref or id. Prefer refs from list_timeline like 'clip-1'.",
		},
		{
			key: "elementId",
			type: "string",
			required: false,
			description: "Legacy fallback. Prefer target.",
		},
	],
	returns:
		"On success: object with base fields { elementId, trackId, type, name, start, end, duration, trimStart, trimEnd } plus type-specific fields. Video: assetId, transform, opacity, blendMode, hidden, volume, muted, masks, effects, animations. Text: content, fontSize, fontFamily, color, fontWeight, fontStyle, textAlign, letterSpacing, lineHeight, background, transform, opacity, blendMode, hidden, effects, animations. Audio: assetId, sourceType, volume, muted, animations. Effect: effectType, params. Image/Graphic: similar to video. Sticker: stickerId, transform, opacity, blendMode, hidden, effects, animations. On error: { error: string }.",
	notes: "Use this to inspect an element's current state before modifying it. Supports ref resolution — pass refs like 'clip-1' or 'text-3'. The animations field includes keyframe count and details if the element has keyframes.",
};

export const updateClipSchema: ToolSchema = {
	name: "update_clip",
	description:
		"Updates properties of any timeline element (video, image, graphic, text, sticker, audio, effect). Prefer target with a human ref from list_timeline, then get_element to inspect current values. Only provide the properties you want to change. mask: { action: 'add', maskType } to add, { action: 'update', params: {...} } to modify, { action: 'remove' } to delete. Mask types: rectangle, ellipse, heart, diamond, star, split, cinematic-bars. Only video/image/graphic support masks. name: rename the element. trimStart/trimEnd: seconds to trim from the source start/end (slip trim without moving the clip). opacity: 0-100. positionX/positionY: position offset. rotation: degrees. scaleX/scaleY: scale factor. blendMode: normal, darken, multiply, screen, overlay, lighten. hidden: boolean. volume: 0-100 (video/audio only). muted: boolean (video/audio only).",
	parameters: [
		{
			key: "target",
			type: "string",
			required: true,
			aliases: ["elementId"],
			description:
				"Timeline element ref or id. Prefer refs from list_timeline like 'clip-1'.",
		},
		{
			key: "elementId",
			type: "string",
			required: false,
			description: "Legacy fallback. Prefer target.",
		},
		{ key: "name", type: "string", required: false, description: "New element name. Must be non-empty." },
		{ key: "mask", type: "object", required: false, description: "Mask action: { action: 'add', maskType: 'rectangle'|'ellipse'|'heart'|'diamond'|'star'|'split'|'cinematic-bars' } or { action: 'update', params: {...} } or { action: 'remove' }. Video/image/graphic only." },
		{ key: "trimStart", type: "number", required: false, description: "Seconds to trim from source start. Slip trim — does not move the clip. Must be >= 0." },
		{ key: "trimEnd", type: "number", required: false, description: "Seconds to trim from source end. Slip trim — does not move the clip. Must be >= 0." },
		{ key: "opacity", type: "number", required: false, description: "Opacity 0-100. Not all element types support this." },
		{ key: "positionX", type: "number", required: false, description: "X position offset. Elements with transform only." },
		{ key: "positionY", type: "number", required: false, description: "Y position offset. Elements with transform only." },
		{ key: "rotation", type: "number", required: false, description: "Rotation in degrees. Elements with transform only." },
		{ key: "scaleX", type: "number", required: false, description: "Scale factor X. Elements with transform only." },
		{ key: "scaleY", type: "number", required: false, description: "Scale factor Y. Elements with transform only." },
		{
			key: "blendMode",
			type: "string",
			required: false,
			enum: ["normal", "darken", "multiply", "screen", "overlay", "lighten"],
			description: "Blend mode. Not all element types support this.",
		},
		{ key: "hidden", type: "boolean", required: false, description: "Hide/show the element." },
		{ key: "volume", type: "number", required: false, description: "Volume 0-100. Video/audio elements only." },
		{ key: "muted", type: "boolean", required: false, description: "Mute/unmute. Video/audio elements only." },
	],
	returns:
		"On success: { success: true, elementId, applied: Record<string, unknown> }. The applied object contains only the properties that were actually updated. On error: { error: string }.",
	notes: "At least one property must be provided. Supports ref resolution via target parameter. Some properties are type-restricted: masks only on video/image/graphic, volume/muted only on video/audio, transform only on elements with transform support. trimStart/trimEnd are slip trims — they change what portion of the source is visible without moving the clip on the timeline.",
};

export const listKeyframesSchema: ToolSchema = {
	name: "list_keyframes",
	description:
		"Returns all keyframes for a timeline element, grouped by animated property. Each keyframe includes an id, time (seconds from element start), value, and interpolation type. Use this to inspect existing animations before modifying them. Use list_timeline to discover elementIds.",
	parameters: [{ key: "elementId", type: "string", required: true, description: "Element id from list_timeline." }],
	returns:
		"On success: { elementId, keyframes: Array<{propertyPath, id, time, value, interpolation}> }. On error: { error: string }.",
	notes: "time is seconds from element start, NOT timeline start. To convert to timeline time: element.start + keyframe.time. Keyframes are grouped by propertyPath across all animated properties.",
};

export const upsertKeyframeSchema: ToolSchema = {
	name: "upsert_keyframe",
	description:
		"Adds or updates a keyframe on a timeline element's animated property. time is seconds from element start. For numeric properties (opacity, position, scale, rotation, volume, padding, cornerRadius), pass value as a number. For color properties (color, background.color), pass colorValue as a hex string like '#ff0000'. interpolation can be linear, hold, or bezier. Use list_animatable_properties to discover valid propertyPaths for an element. Use list_keyframes to get existing keyframeId for updates.",
	parameters: [
		{ key: "elementId", type: "string", required: true, description: "Element id from list_timeline." },
		{ key: "propertyPath", type: "string", required: true, description: "Animatable property path. Use list_animatable_properties to discover valid paths." },
		{ key: "time", type: "number", required: true, description: "Time in seconds from element start (NOT timeline start). Must be >= 0 and <= element duration." },
		{ key: "value", type: "number", required: false, description: "Numeric value for numeric properties. Required for non-color properties." },
		{ key: "colorValue", type: "string", required: false, description: "Hex color string for color properties (e.g. '#ff0000'). Required for color properties: 'color', 'background.color'." },
		{ key: "interpolation", type: "string", required: false, description: "'linear', 'hold', or 'bezier'. Default: 'linear'." },
		{ key: "keyframeId", type: "string", required: false, description: "Existing keyframe id to update. If omitted, a new keyframe is created." },
	],
	returns:
		"On success: { success: true, elementId, propertyPath, keyframeId, time, value, interpolation }. On error: { error: string }.",
	notes: "For numeric properties use 'value', for color properties ('color', 'background.color') use 'colorValue' as hex string. time is relative to element start, NOT timeline start. Must be within element duration (0 to element.duration). Use list_animatable_properties to discover valid propertyPaths. Pass keyframeId to update an existing keyframe instead of creating a new one.",
};

export const removeKeyframeSchema: ToolSchema = {
	name: "remove_keyframe",
	description:
		"Removes a specific keyframe from a timeline element. Use list_keyframes to discover keyframeIds. When the last keyframe on a property is removed, the property reverts to its static value.",
	parameters: [
		{ key: "elementId", type: "string", required: true, description: "Element id from list_timeline." },
		{ key: "propertyPath", type: "string", required: true, description: "Property path the keyframe belongs to." },
		{ key: "keyframeId", type: "string", required: true, description: "Keyframe id from list_keyframes." },
	],
	returns:
		"On success: { success: true, removedKeyframeId: string }. On error: { error: string }.",
	notes: "When the last keyframe on a property is removed, the property reverts to its static (non-animated) value. Use list_keyframes first to discover keyframeIds.",
};

export const updateKeyframeCurveSchema: ToolSchema = {
	name: "update_keyframe_curve",
	description:
		"Updates the curve/interpolation of an existing scalar keyframe. interpolation can be linear, bezier, or step. For bezier curves, optionally pass rightHandle and leftHandle as {dt, dv} offsets from the keyframe point. tangentMode can be auto, aligned, broken, or flat. Use list_keyframes to discover keyframeIds.",
	parameters: [
		{ key: "elementId", type: "string", required: true, description: "Element id from list_timeline." },
		{ key: "propertyPath", type: "string", required: true, description: "Property path the keyframe belongs to." },
		{ key: "keyframeId", type: "string", required: true, description: "Keyframe id from list_keyframes." },
		{ key: "interpolation", type: "string", required: false, description: "'linear', 'bezier', or 'step'." },
		{ key: "rightHandle", type: "object", required: false, description: "Bezier right handle offset: { dt: number, dv: number }. Only used with 'bezier' interpolation." },
		{ key: "leftHandle", type: "object", required: false, description: "Bezier left handle offset: { dt: number, dv: number }. Only used with 'bezier' interpolation." },
		{ key: "tangentMode", type: "string", required: false, description: "'auto', 'aligned', 'broken', or 'flat'. Controls how handles are computed." },
	],
	returns:
		"On success: { success: true, elementId, keyframeId, applied: Record<string, unknown> }. applied shows what was changed. On error: { error: string }.",
	notes: "Switching from bezier to linear/step clears the handles. tangentMode controls how bezier handles are computed: 'auto' (smooth), 'aligned' (handles stay aligned), 'broken' (independent handles), 'flat' (horizontal handles).",
};

export const listAnimatablePropertiesSchema: ToolSchema = {
	name: "list_animatable_properties",
	description:
		"Returns the list of property paths that support animation for a given timeline element. Each property includes its path, value type (number or color), and current static value. Use this before calling upsert_keyframe to discover which properties can be animated.",
	parameters: [{ key: "elementId", type: "string", required: true, description: "Element id from list_timeline." }],
	returns:
		"On success: { elementId, elementType, properties: Array<{path, valueType: 'number'|'color', currentValue}> }. On error: { error: string }.",
	notes: "Always call this before upsert_keyframe to discover valid propertyPaths. Different element types support different properties. valueType 'number' needs the 'value' param in upsert_keyframe; valueType 'color' needs 'colorValue'.",
};

export const listSkillsSchema: ToolSchema = {
	name: "list_skills",
	description:
		"Lists available editing skill recipes — pre-built workflows for common editing patterns like viral shorts, pitch videos, and more. Each skill contains a structured recipe with specific tool sequences, timing, and styling rules. Returns skill id, name, and short description. Use this to discover relevant skills, then call load_skill to get full instructions and apply them.",
	parameters: [{ key: "query", type: "string", required: false, description: "Optional search query to filter skills by name, description, or keywords." }],
	returns:
		"On success: { skills: Array<{id, name, description, keywords: string[]}> }. On error: { error: string }.",
	notes: "Returns built-in editing skill recipes. Skills are technique libraries — they teach you HOW to approach a type of edit. After loading a skill, use the standard editing tools to execute the recipe.",
};

export const loadSkillSchema: ToolSchema = {
	name: "load_skill",
	description:
		"Loads the full instructions for a specific skill by its id. After loading, follow the skill's instructions to accomplish the user's request using the standard editing tools (split, add_text, apply_effect, upsert_keyframe, etc.). Each skill contains a complete recipe with sections, timing rules, text styles, effect parameters, and a quality checklist. Always call list_skills first to discover available skills.",
	parameters: [{ key: "skillId", type: "string", required: true, description: "Skill id from list_skills, e.g. 'viral-short' or 'pitch-video'." }],
	returns:
		"On success: { skillId, name, instructions: string }. instructions is the full recipe text. On error: { error: string }.",
	notes: "instructions is a comprehensive text with sections, timing rules, text styles, effect parameter values, and quality checklists. Adapt the techniques to the actual footage content — never copy blindly.",
};

export const submitPlanSchema: ToolSchema = {
	name: "submit_plan",
	description:
		"Submits a structured editing plan with numbered steps for user approval. Returns step IDs — use update_plan_step with the step number (1, 2, 3...) to track progress. Each step needs a description and tools array.",
	parameters: [
		{ key: "summary", type: "string", required: true, description: "One-line plan summary." },
		{ key: "steps", type: "array", required: true, description: "Array of { description: string, tools: string[] } or a numbered list string. Each step describes what to do and which tools it uses." },
		{ key: "questions", type: "array", required: false, description: "Optional array of question strings to ask the user before approval." },
	],
	returns:
		"On approval: { planId, stepCount, approved: true, mode: 'execute' }. On rejection: { planId, stepCount, approved: false, mode: 'plan' }. On error: { error: string }.",
	notes: "BLOCKS until user approves or rejects. After approval, use update_plan_step with step number (1-based) to mark progress. Steps can be an array of objects or a numbered string. This is the primary way to transition from planning to execution.",
};

export const askUserSchema: ToolSchema = {
	name: "ask_user",
	description:
		"Asks the user a question before or during planning. Use when you need clarification about their intent, preferences, or content details before finalizing the plan. Optionally provide quick-reply options for common answers. The user can also type a free-form response.",
	parameters: [
		{ key: "question", type: "string", required: true, description: "The question to ask." },
		{ key: "options", type: "array", required: false, description: "Optional quick-reply options: Array<{ label: string, description?: string }>." },
	],
	returns:
		"On response: { questionId, answer: string }. The answer is the user's typed response or the label of their chosen option. On error: { error: string }.",
	notes: "BLOCKS until user responds. Use during planning to clarify intent, preferences, or content details before committing to a plan.",
};

export const requestPlanApprovalSchema: ToolSchema = {
	name: "request_plan_approval",
	description:
		"Requests user approval to switch from planning to editing for an already submitted plan. Usually you do not need this because submit_plan already waits for approval. The user sees a plan card with Keep planning and Go edit options.",
	parameters: [],
	returns:
		"On approval: { approved: true, mode: 'execute' }. On rejection: { approved: false, mode: 'plan' }. On error: { error: string }.",
	notes: "BLOCKS until user responds. Requires a plan to exist first — call submit_plan before this. Usually unnecessary because submit_plan already waits for approval.",
};

export const updatePlanStepSchema: ToolSchema = {
	name: "update_plan_step",
	description:
		"Updates the status of a plan step during execution. Prefer using step (1-based number matching plan order) over stepId. The plan panel updates in real-time. Use status 'in_progress' when starting, 'done' for successful completion, or 'skipped' if unnecessary.",
	parameters: [
		{ key: "step", type: "number", required: false, description: "1-based step number matching plan order. Preferred over stepId." },
		{ key: "stepId", type: "string", required: false, description: "Specific step id. Prefer step number." },
		{
			key: "status",
			type: "string",
			required: true,
			enum: ["pending", "in_progress", "done", "skipped"],
			description: "New status for the step.",
		},
		{ key: "result", type: "string", required: false, description: "Optional result description or error message." },
	],
	returns:
		"On success: { success: true, step: number, stepId: string, status: string }. On error: { error: string }.",
	notes: "Prefer step number (1-based) over stepId for simplicity. Only available during execute mode. Requires an active plan.",
};

export const renderPreviewSchema: ToolSchema = {
	name: "render_preview",
	description:
		"Renders a temporary low-quality video preview of the full timeline and loads it into context. The exported video includes all tracks, text, effects, and audio. Use this to review the final result after completing edits. The video will be available in your multimodal context automatically for analysis.",
	parameters: [],
	returns:
		"On success: { status: 'rendered', duration: number, format: 'mp4', context: { kind: 'media', assetName: '_preview.mp4', fileUri: string, mimeType: 'video/mp4' } }. The fileUri is a Gemini File API URI automatically injected into the conversation. On error: { error: string }.",
	notes: "Exports the full timeline as a low-quality MP4 with audio, uploads to Gemini, and injects it as multimodal context. Use after completing edits for visual review. The video is temporary and low-quality — not a final export.",
};

/**
 * Builds the enriched description string that gets sent to the LLM.
 * Appends return type and usage notes to the base description so the
 * model knows exactly what each tool returns and how to use it.
 */
export function buildProviderDescription(schema: ToolSchema): string {
	const parts = [schema.description];

	if (schema.returns) {
		parts.push(`\n\nReturns: ${schema.returns}`);
	}

	if (schema.notes) {
		parts.push(`\n\nNotes: ${schema.notes}`);
	}

	return parts.join("");
}

/**
 * The exact list of schemas exposed to the LLM.
 * Excludes internal-only tools (transcribe_video, mock).
 */
export const providerToolSchemas: ToolSchema[] = [
	loadContextSchema,
	transcribeAudioSchema,
	listProjectAssetsSchema,
	listTimelineSchema,
	getElementSchema,
	splitSchema,
	deleteTimelineElementsSchema,
	moveTimelineElementsSchema,
	duplicateElementsSchema,
	addMediaToTimelineSchema,
	updateTimelineElementTimingSchema,
	addTextSchema,
	updateTextSchema,
	listEffectsSchema,
	getEffectSchema,
	applyEffectSchema,
	updateEffectSchema,
	updateClipSchema,
	undoSchema,
	redoSchema,
	toggleTrackMuteSchema,
	toggleTrackVisibilitySchema,
	listKeyframesSchema,
	upsertKeyframeSchema,
	removeKeyframeSchema,
	updateKeyframeCurveSchema,
	listAnimatablePropertiesSchema,
	listSkillsSchema,
	loadSkillSchema,
	submitPlanSchema,
	askUserSchema,
	requestPlanApprovalSchema,
	updatePlanStepSchema,
	renderPreviewSchema,
];
