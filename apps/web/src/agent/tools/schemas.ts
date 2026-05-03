import type { ToolParameter, ToolSchema } from "@/agent/types";

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
		"Loads Gemini multimodal context for a project asset or timeline element. For media: targetType='asset' with id (asset name like 'intro.mov' or internal id). For timeline elements: targetType='timeline_element' with id (element ref like 'intro-1', 'text-1', or elementId).",
	parameters: [
		{
			key: "targetType",
			type: "string",
			required: true,
			description: "'asset' or 'timeline_element'.",
			enum: ["asset", "timeline_element"],
		},
		{
			key: "id",
			type: "string",
			required: false,
			description: "Asset name/id or element ref/id.",
		},
		{
			key: "assetId",
			type: "string",
			required: false,
			description: "Asset id or name.",
		},
		{
			key: "elementId",
			type: "string",
			required: false,
			description: "Element id, ref, or displayName.",
		},
	],
};

export const transcribeAudioSchema: ToolSchema = {
	name: "transcribe_audio",
	description:
		"Transcribes audio/video with word-level timing. Returns full text, per-word timestamps, confidence, and utterance segments. Auto-selects if only one audio/video asset exists.",
	parameters: [
		{
			key: "assetId",
			type: "string",
			required: false,
			description: "Asset name or id. Auto-selects if omitted and only one audio/video asset.",
		},
		{
			key: "language",
			type: "string",
			required: false,
			description: "Language hint. 'auto' or omit when unknown.",
		},
	],
};

export const listProjectAssetsSchema: ToolSchema = {
	name: "list_project_assets",
	description:
		"Lists project media assets with id, type, duration, and timeline usage. Call before add_media_to_timeline or load_context.",
	parameters: [
		{ key: "filter", type: "string", required: false, description: "'all', 'used', or 'unused'. Default: 'all'." },
		{ key: "type", type: "string", required: false, description: "'all', 'video', 'audio', or 'image'. Default: 'all'." },
	],
};

export const listTimelineSchema: ToolSchema = {
	name: "list_timeline",
	description:
		"Lists active timeline as tracks with elements. Each element has ref (semantic, like 'intro-1', 'text-1'), displayName (human-readable label), start/end in seconds. Tracks include position, visualLayer (higher=above, null for audio), stacking. Call before any edit to discover elements. Refs change after split/delete — recall after writes.",
	parameters: [],
};

export const splitSchema: ToolSchema = {
	name: "split",
	description:
		"Splits elements at times in seconds. Does NOT delete or move content. After splitting, element refs change — call list_timeline again before using refs in subsequent operations. Omit target to split all elements at those times.",
	parameters: [
		{
			key: "times",
			type: "number[]",
			required: true,
			description: "Timeline times in seconds to split at.",
		},
		{
			key: "target",
			type: "string",
			required: false,
			description: "Element ref, displayName, or elementId to restrict split to.",
		},
	],
};

export const deleteTimelineElementsSchema: ToolSchema = {
	name: "delete_timeline_elements",
	description:
		"Deletes elements by refs or ids. To delete a time range: split at boundaries first, then delete isolated refs.",
	parameters: [
		{
			key: "targets",
			type: "array",
			required: true,
			aliases: ["elementIds"],
			description: "Element refs or ids to delete.",
			items: { key: "target", type: "string", required: true },
		},
		{
			key: "elementIds",
			type: "string[]",
			required: false,
			description: "Legacy. Prefer targets.",
		},
	],
};

export const moveTimelineElementsSchema: ToolSchema = {
	name: "move_timeline_elements",
	description:
		"Moves elements to a new start time. Earliest element placed at 'start', others keep relative offsets. Optionally move to another track via targetTrackRef.",
	parameters: [
		{
			key: "targets",
			type: "array",
			required: true,
			aliases: ["elementIds"],
			description: "Element refs or ids to move.",
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
			description: "Target track ref from list_timeline.",
		},
		{
			key: "elementIds",
			type: "string[]",
			required: false,
			description: "Legacy. Prefer targets.",
		},
		{
			key: "targetTrackId",
			type: "string",
			required: false,
			description: "Legacy. Prefer targetTrackRef.",
		},
	],
};

export const addMediaToTimelineSchema: ToolSchema = {
	name: "add_media_to_timeline",
	description:
		"Adds a project media asset to the timeline. Use list_project_assets first for assetId. New track auto-created if needed.",
	parameters: [
		{ key: "assetId", type: "string", required: true, description: "Internal asset id from list_project_assets." },
		{ key: "startTime", type: "number", required: true, description: "Start position in seconds." },
		{ key: "trackType", type: "string", required: true, description: "'main'/'overlay' for video/image, 'audio' for audio." },
		{ key: "duration", type: "number", required: false, description: "Duration in seconds. Defaults to full asset." },
	],
};

export const updateTimelineElementTimingSchema: ToolSchema = {
	name: "update_timeline_element_timing",
	description:
		"Updates element timing. Provide at least one of start, end, or duration. If both end and duration are provided, they must be consistent (end = start + duration). Does NOT accept refs — use elementId from list_timeline.",
	parameters: [
		{ key: "elementId", type: "string", required: true, description: "Element id from list_timeline." },
		{ key: "start", type: "number", required: false, description: "New start in seconds." },
		{ key: "end", type: "number", required: false, description: "New end in seconds." },
		{ key: "duration", type: "number", required: false, description: "New duration in seconds." },
	],
};

const textItemProperties: ToolParameter[] = [
	{ key: "text", type: "string", required: true, description: "Text content." },
	{ key: "start", type: "number", required: true, description: "Start in seconds." },
	{ key: "end", type: "number", required: true, description: "End in seconds." },
	{
		key: "position",
		type: "string",
		required: false,
		enum: ["top", "center", "bottom"],
		description: "Vertical preset (rough). Prefer positionY for precise control.",
	},
	{ key: "color", type: "string", required: false, description: "Hex color." },
	{ key: "fontSize", type: "number", required: false, description: "Font size." },
	{ key: "fontFamily", type: "string", required: false, description: "Font family." },
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
	{ key: "letterSpacing", type: "number", required: false, description: "Letter spacing." },
	{ key: "positionX", type: "number", required: false, description: "Absolute X offset in pixels from canvas center. 0=center, positive=right, negative=left. Typical range ±(width/2)." },
	{ key: "positionY", type: "number", required: false, description: "Absolute Y offset in pixels from canvas center. 0=center, positive=down, negative=up. Typical range ±(height/2)." },
	{ key: "scaleX", type: "number", required: false, description: "Scale X (0.5 = 50%). Default: 1." },
	{ key: "scaleY", type: "number", required: false, description: "Scale Y (0.5 = 50%). Default: 1." },
	{ key: "background", type: "object", required: false, description: "{ enabled, color?, cornerRadius?, padding? }" },
];

export const addTextSchema: ToolSchema = {
	name: "add_text",
	description:
		"Adds text to timeline. Single: pass text, start, end, position. Batch: pass 'texts' array with multiple text objects, each fully independent (different styles, positions, etc). Prefer batch for 2+ text elements.",
	parameters: [
		{
			key: "texts",
			type: "array",
			required: false,
			description:
				"Batch mode: array of text objects to add at once. Each item is fully independent.",
			items: {
				key: "item",
				type: "object",
				properties: textItemProperties,
			},
		},
		...textItemProperties,
	],
};

export const updateTextSchema: ToolSchema = {
	name: "update_text",
	description:
		"Updates text element properties. Batch: all targets get same overrides. Non-text elements skipped.",
	parameters: [
		{
			key: "targets",
			type: "array",
			required: true,
			aliases: ["elementIds"],
			description: "Text element refs, displayNames, or elementIds.",
			items: { key: "target", type: "string", required: true },
		},
		{
			key: "elementIds",
			type: "array",
			required: false,
			description: "Legacy. Prefer targets.",
		},
		{ key: "content", type: "string", required: false, description: "New text content." },
		{ key: "color", type: "string", required: false, description: "Hex color." },
		{ key: "fontSize", type: "number", required: false, description: "Font size." },
		{ key: "fontFamily", type: "string", required: false, description: "Font family." },
		{ key: "fontWeight", type: "string", required: false, enum: ["normal", "bold"] },
		{ key: "fontStyle", type: "string", required: false, enum: ["normal", "italic"] },
		{ key: "textAlign", type: "string", required: false, enum: ["left", "center", "right"] },
		{ key: "letterSpacing", type: "number", required: false },
		{ key: "positionX", type: "number", required: false, description: "Absolute X offset in pixels from canvas center. 0=center, positive=right, negative=left. Typical range ±(width/2)." },
		{ key: "positionY", type: "number", required: false, description: "Absolute Y offset in pixels from canvas center. 0=center, positive=down, negative=up. Typical range ±(height/2)." },
		{ key: "scaleX", type: "number", required: false, description: "Scale X (0.5 = 50%). Default: 1." },
		{ key: "scaleY", type: "number", required: false, description: "Scale Y (0.5 = 50%). Default: 1." },
		{ key: "background", type: "object", required: false, description: "{ enabled, color?, cornerRadius?, padding? }" },
	],
};

export const listEffectsSchema: ToolSchema = {
	name: "list_effects",
	description: "Lists available effects with id, name, description. Use before get_effect → apply_effect.",
	parameters: [{ key: "query", type: "string", required: false, description: "Search query." }],
};

export const getEffectSchema: ToolSchema = {
	name: "get_effect",
	description: "Returns effect parameter definitions (types, ranges, defaults). Call before apply_effect.",
	parameters: [{ key: "effectType", type: "string", required: true, description: "Effect id from list_effects." }],
};

export const applyEffectSchema: ToolSchema = {
	name: "apply_effect",
	description:
		"Adds effect to timeline covering start→end. Applies to all visual elements overlapping that range. Omitted params use defaults.",
	parameters: [
		{ key: "effectType", type: "string", required: true, description: "Effect id from list_effects." },
		{ key: "start", type: "number", required: true, description: "Start in seconds." },
		{ key: "end", type: "number", required: true, description: "End in seconds." },
		{ key: "params", type: "object", required: false, description: "Key-value params. Use get_effect for valid keys." },
	],
};

export const updateEffectSchema: ToolSchema = {
	name: "update_effect",
	description:
		"Updates effect params. Batch via targets array. Only provided params change.",
	parameters: [
		{
			key: "targets",
			type: "array",
			required: true,
			aliases: ["elementIds", "elementId"],
			description: "Effect element refs or ids.",
			items: { key: "target", type: "string", required: true },
		},
		{ key: "params", type: "object", required: true, description: "Params to update." },
	],
};

export const redoSchema: ToolSchema = {
	name: "redo",
	description: "Redoes last undone action. Consecutive calls redo more.",
	parameters: [],
};

export const toggleTrackMuteSchema: ToolSchema = {
	name: "toggle_track_mute",
	description: "Toggles mute on a track. Works on video/audio tracks only.",
	parameters: [{ key: "trackId", type: "string", required: true, description: "Track id from list_timeline." }],
};

export const toggleTrackVisibilitySchema: ToolSchema = {
	name: "toggle_track_visibility",
	description: "Toggles track visibility. Hidden tracks aren't rendered.",
	parameters: [{ key: "trackId", type: "string", required: true, description: "Track id from list_timeline." }],
};

export const undoSchema: ToolSchema = {
	name: "undo",
	description: "Undoes last edit. Consecutive calls undo earlier actions.",
	parameters: [],
};

export const duplicateElementsSchema: ToolSchema = {
	name: "duplicate_elements",
	description: "Duplicates elements onto new tracks above originals.",
	parameters: [{ key: "elementIds", type: "string[]", required: true, description: "Element ids (not refs)." }],
};

export const getElementSchema: ToolSchema = {
	name: "get_element",
	description:
		"Returns full metadata for one element. Includes type-specific fields (transform, opacity, masks, effects, animations, etc.).",
	parameters: [
		{
			key: "target",
			type: "string",
			required: true,
			aliases: ["elementId"],
			description: "Element ref, displayName, or elementId.",
		},
		{
			key: "elementId",
			type: "string",
			required: false,
			description: "Legacy. Prefer target.",
		},
	],
};

export const updateClipSchema: ToolSchema = {
	name: "update_clip",
	description:
		"Updates element properties (batch via targets). Provide only fields to change. Some properties are type-restricted: masks (video/image/graphic), volume/muted (video/audio), transform (elements with transform). trimStart/trimEnd are slip trims.",
	parameters: [
		{
			key: "targets",
			type: "array",
			required: true,
			aliases: ["target", "elementIds", "elementId"],
			description: "Element refs or ids.",
			items: { key: "target", type: "string", required: true },
		},
		{ key: "name", type: "string", required: false, description: "New name." },
		{ key: "mask", type: "object", required: false, description: "{ action: 'add'|'update'|'remove', maskType?, params? }" },
		{ key: "trimStart", type: "number", required: false, description: "Seconds to trim from source start (slip)." },
		{ key: "trimEnd", type: "number", required: false, description: "Seconds to trim from source end (slip)." },
		{ key: "opacity", type: "number", required: false, description: "0-100." },
		{ key: "positionX", type: "number", required: false, description: "Absolute X offset in pixels from canvas center. 0=center, positive=right, negative=left. Typical range ±(width/2)." },
		{ key: "positionY", type: "number", required: false, description: "Absolute Y offset in pixels from canvas center. 0=center, positive=down, negative=up. Typical range ±(height/2)." },
		{ key: "rotation", type: "number", required: false, description: "Degrees." },
		{ key: "scaleX", type: "number", required: false, description: "Scale X." },
		{ key: "scaleY", type: "number", required: false, description: "Scale Y." },
		{
			key: "blendMode",
			type: "string",
			required: false,
			enum: ["normal", "darken", "multiply", "screen", "overlay", "lighten"],
		},
		{ key: "hidden", type: "boolean", required: false, description: "Hide/show." },
		{ key: "volume", type: "number", required: false, description: "Relative volume offset from baseline. 0 = no change, positive = louder, negative = quieter. Typical range: -50 to +20. Example: -15 for background music under voice, +10 to boost voiceover (video/audio)." },
		{ key: "muted", type: "boolean", required: false, description: "Mute/unmute (video/audio)." },
	],
};

export const listKeyframesSchema: ToolSchema = {
	name: "list_keyframes",
	description:
		"Returns keyframes for an element. time is seconds from element start, NOT timeline start. To convert: timeline_time = element.start + keyframe.time.",
	parameters: [{ key: "elementId", type: "string", required: true, description: "Element id." }],
};

export const upsertKeyframeSchema: ToolSchema = {
	name: "upsert_keyframe",
	description:
		"Adds/updates a keyframe. time is seconds from element start, NOT timeline start. Must be 0 to element duration. Use 'value' for numeric props, 'colorValue' (hex) for color props. Use list_animatable_properties for valid paths.",
	parameters: [
		{ key: "elementId", type: "string", required: true, description: "Element id." },
		{ key: "propertyPath", type: "string", required: true, description: "From list_animatable_properties." },
		{ key: "time", type: "number", required: true, description: "Seconds from element start." },
		{ key: "value", type: "number", required: false, description: "Numeric value." },
		{ key: "colorValue", type: "string", required: false, description: "Hex color for color properties." },
		{ key: "interpolation", type: "string", required: false, description: "'linear', 'hold', or 'bezier'." },
		{ key: "keyframeId", type: "string", required: false, description: "Existing keyframe id to update." },
	],
};

export const removeKeyframeSchema: ToolSchema = {
	name: "remove_keyframe",
	description: "Removes a keyframe. Last keyframe on a property reverts it to static value.",
	parameters: [
		{ key: "elementId", type: "string", required: true, description: "Element id." },
		{ key: "propertyPath", type: "string", required: true, description: "Property path." },
		{ key: "keyframeId", type: "string", required: true, description: "Keyframe id from list_keyframes." },
	],
};

export const updateKeyframeCurveSchema: ToolSchema = {
	name: "update_keyframe_curve",
	description:
		"Updates keyframe interpolation. For bezier, pass rightHandle/leftHandle as {dt, dv}. tangentMode: auto, aligned, broken, flat.",
	parameters: [
		{ key: "elementId", type: "string", required: true, description: "Element id." },
		{ key: "propertyPath", type: "string", required: true, description: "Property path." },
		{ key: "keyframeId", type: "string", required: true, description: "Keyframe id." },
		{ key: "interpolation", type: "string", required: false, description: "'linear', 'bezier', or 'step'." },
		{ key: "rightHandle", type: "object", required: false, description: "{ dt, dv } for bezier." },
		{ key: "leftHandle", type: "object", required: false, description: "{ dt, dv } for bezier." },
		{ key: "tangentMode", type: "string", required: false, description: "'auto', 'aligned', 'broken', or 'flat'." },
	],
};

export const listAnimatablePropertiesSchema: ToolSchema = {
	name: "list_animatable_properties",
	description:
		"Returns animatable property paths for an element with valueType ('number' or 'color') and current value. Call before upsert_keyframe.",
	parameters: [{ key: "elementId", type: "string", required: true, description: "Element id." }],
};

export const listSkillsSchema: ToolSchema = {
	name: "list_skills",
	description:
		"Lists editing skill recipes (viral shorts, pitch videos, etc.). Returns id, name, description, keywords.",
	parameters: [{ key: "query", type: "string", required: false, description: "Search query." }],
};

export const loadSkillSchema: ToolSchema = {
	name: "load_skill",
	description:
		"Loads full skill instructions by id. Contains tool sequences, timing rules, styles, effect params. Adapt to actual footage.",
	parameters: [{ key: "skillId", type: "string", required: true, description: "Skill id from list_skills." }],
};

export const submitPlanSchema: ToolSchema = {
	name: "submit_plan",
	description:
		"Submits an editing plan for user approval. BLOCKS until approved/rejected. Use update_plan_step (1-based step number) to track progress.",
	parameters: [
		{ key: "summary", type: "string", required: true, description: "One-line summary." },
		{ key: "steps", type: "array", required: true, description: "{ description, tools[] } or numbered string." },
		{ key: "questions", type: "array", required: false, description: "Optional questions to ask before approval." },
	],
};

export const askUserSchema: ToolSchema = {
	name: "ask_user",
	description:
		"Asks user a question during planning. BLOCKS until response. Optionally provide quick-reply options.",
	parameters: [
		{ key: "question", type: "string", required: true, description: "Question to ask." },
		{ key: "options", type: "array", required: false, description: "[{ label, description? }]" },
	],
};

export const requestPlanApprovalSchema: ToolSchema = {
	name: "request_plan_approval",
	description:
		"Requests approval for a submitted plan. Usually unnecessary — submit_plan already waits for approval.",
	parameters: [],
};

export const updatePlanStepSchema: ToolSchema = {
	name: "update_plan_step",
	description:
		"Updates plan step status. Prefer step (1-based number) over stepId.",
	parameters: [
		{ key: "step", type: "number", required: false, description: "1-based step number." },
		{ key: "stepId", type: "string", required: false, description: "Step id. Prefer step." },
		{
			key: "status",
			type: "string",
			required: true,
			enum: ["pending", "in_progress", "done", "skipped"],
			description: "New status.",
		},
		{ key: "result", type: "string", required: false, description: "Result or error message." },
	],
};

export const renderPreviewSchema: ToolSchema = {
	name: "render_preview",
	description:
		"Renders low-quality MP4 preview of full timeline and loads into multimodal context. Use after edits for visual review.",
	parameters: [],
};

export function buildProviderDescription(schema: ToolSchema): string {
	return schema.description;
}

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
	updatePlanStepSchema,
	renderPreviewSchema,
];
