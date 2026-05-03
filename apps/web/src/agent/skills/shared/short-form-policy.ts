/**
 * Shared policy for short-form content skills.
 * Single source of truth for rules that must stay consistent across
 * short-form skill variants (short-form, viral-short, etc.).
 *
 * Change a rule here → it propagates to all short-form skills.
 */

// ── Text Policy ───────────────────────────────────────────────

/** Scale applied to ALL text elements (scaleX and scaleY). */
export const TEXT_SCALE = 0.5;

/** Recommended font size for caption/subtitle elements. */
export const CAPTION_FONT_SIZE = 6.5;

/** Minimum acceptable caption font size. */
export const CAPTION_FONT_SIZE_MIN = 6;

/** Maximum acceptable caption font size. Never exceed. */
export const CAPTION_FONT_SIZE_MAX = 8;

/** Maximum font size for titles, hooks, CTA, and emphasis text. */
export const TITLE_FONT_SIZE_MAX = 12;

/** Maximum words per caption/subtitle element. */
export const MAX_WORDS_PER_CAPTION = 3;

/** Default text color for all elements. */
export const DEFAULT_TEXT_COLOR = "#FFFFFF";

/** Default font weight for all text elements. */
export const DEFAULT_FONT_WEIGHT = "bold";

/** Default subtitle/caption position. */
export const DEFAULT_SUBTITLE_POSITION = "bottom";

// ── Volume Policy ─────────────────────────────────────────────

/** Volume baseline (no change from original). */
export const VOLUME_BASELINE = 0;

/** Voice boost range when voice needs to be louder. */
export const VOICE_BOOST_RANGE: readonly [number, number] = [8, 12];

/** Absolute maximum voice volume. Never exceed. */
export const VOICE_ABSOLUTE_MAX = 15;

/** Background music volume range when voice is present. */
export const MUSIC_WITH_VOICE_RANGE: readonly [number, number] = [-20, -15];

/** Conservative music range when unsure (go lower). */
export const MUSIC_CONSERVATIVE_RANGE: readonly [number, number] = [-25, -20];

/** Clip audio volume range when voice is also present. */
export const CLIP_WITH_VOICE_RANGE: readonly [number, number] = [-15, -10];

/** Music volume range when there is no speech. */
export const MUSIC_NO_SPEECH_RANGE: readonly [number, number] = [3, 5];

// ── Section Renderers ─────────────────────────────────────────

/**
 * Renders the mandatory creative gating section.
 * Shared across all short-form skill variants.
 */
export function renderCreativeGating(): string {
	return `## ⚠️ MANDATORY CREATIVE GATING

Before planning or editing, you MUST check whether the user has provided direction on these creative decisions:

### Required creative decisions:
1. **Subtitle position** — ${DEFAULT_SUBTITLE_POSITION} (default) vs center vs other?
2. **Typography style** — font family and weight
3. **Text color** — white (default), yellow, or custom?
4. **Visual effects** — zoom drift, glow, vignette, or clean/no effects?
5. **Clip audio** — keep original clip audio or mute it?

### Gating rules:
- If the user has NOT addressed 3 or more of these, you MUST call ask_user BEFORE submit_plan or any direct editing.
- Ask 2–3 concrete questions max.
- If the user says something like "hacelo vos", "default", "decidilo vos", "whatever you think", "I don't care" — treat ALL unanswered decisions as defaults and proceed WITHOUT asking.
- If the user already gave enough direction (e.g. "white text, bottom subtitles, no effects, mute clips"), don't ask anything — just execute.
- NEVER skip this check. Even in execute mode, if creative decisions are missing, ask_user first.`;
}

/**
 * Renders the volume model section with concrete rules.
 * Shared across all short-form skill variants.
 */
export function renderVolumeModel(): string {
	const [vMin, vMax] = VOICE_BOOST_RANGE;
	const [mLow, mHigh] = MUSIC_WITH_VOICE_RANGE;
	const [cLow, cHigh] = MUSIC_CONSERVATIVE_RANGE;
	const [clipLow, clipHigh] = CLIP_WITH_VOICE_RANGE;
	const [sMin, sMax] = MUSIC_NO_SPEECH_RANGE;

	return `## Volume Model (CRITICAL — READ THIS)

This editor uses **relative volume offsets**, NOT percentages. The semantics are:

- **0 = baseline** (no change from original volume)
- **Positive values = louder** (boost above baseline)
- **Negative values = quieter** (cut below baseline)
- **Muted = silent** (use the \`muted: true\` flag, NOT volume: -100)

### Concrete volume rules for short-form with speech:
- **Voiceover / main voice**: keep at 0 (baseline). If the voice needs a boost, use +${vMin} to +${vMax}. Never exceed +${VOICE_ABSOLUTE_MAX}.
- **Background music when voice is present**: set volume to ${mLow} to ${mHigh}. The music should be barely perceptible — pure atmosphere. If unsure, go lower (${cLow} to ${cHigh}). Too quiet is always better than too loud.
- **Clip audio (original footage sound)**: mute by default (muted: true). Only unmute if the user explicitly wants it, and even then lower it to ${clipLow} to ${clipHigh} if voice is also present.
- **Music when NO speech**: can stay at 0 or go slightly positive (+${sMin} to +${sMax}) for energy.

### NEVER use percentage language for volume.
Do NOT say "5% volume", "15% volume", "25% volume". This is WRONG for this editor. Always use the offset model: 0, +10, -15, -20, etc.`;
}

/**
 * Renders the core text/subtitle rules.
 * NON-NEGOTIABLE across all short-form variants.
 */
export function renderSubtitleRules(): string {
	return `### Subtitle Rules (NON-NEGOTIABLE)

When generating captions/subtitles, these rules are NON-NEGOTIABLE:

1. **Scale: ALWAYS scaleX/scaleY = ${TEXT_SCALE}.** Every text element for subtitles/captions uses scaleX: ${TEXT_SCALE}, scaleY: ${TEXT_SCALE}. No exceptions.
2. **Font size by element type:**
   - **Captions/subtitles:** fontSize ${CAPTION_FONT_SIZE} (recommended). Acceptable range: ${CAPTION_FONT_SIZE_MIN}–${CAPTION_FONT_SIZE_MAX}. Never exceed ${CAPTION_FONT_SIZE_MAX}.
   - **Titles / hooks / CTA / emphasis:** fontSize max ${TITLE_FONT_SIZE_MAX}. These need to stand out from captions.
3. **NO background. EVER.** Subtitles must NEVER have a background color or background fill of any kind. They must be text-only — transparent background, always. If you find yourself adding a backgroundColor or backgroundStyle to ANY text element (captions, hook text, CTA text, emphasis text), stop and remove it. The ONLY exception is if the user explicitly asks for backgrounds.
4. **Max ${MAX_WORDS_PER_CAPTION} words per caption/subtitle element.** Each subtitle/caption text element must contain no more than ${MAX_WORDS_PER_CAPTION} words. Break longer phrases into multiple sequential elements if needed.`;
}
