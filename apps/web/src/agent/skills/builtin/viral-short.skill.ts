import type { SkillDefinition } from "../types";
import { skillRegistry } from "../registry";
import {
	renderCreativeGating,
	renderVolumeModel,
	renderSubtitleRules,
	TEXT_SCALE,
	CAPTION_FONT_SIZE,
	CAPTION_FONT_SIZE_MIN,
	CAPTION_FONT_SIZE_MAX,
	TITLE_FONT_SIZE_MAX,
	MAX_WORDS_PER_CAPTION,
	DEFAULT_TEXT_COLOR,
	DEFAULT_FONT_WEIGHT,
	MUSIC_WITH_VOICE_RANGE,
} from "../shared/short-form-policy";

const viralShortSkill: SkillDefinition = {
	id: "viral-short",
	name: "Viral Short",
	description:
		"Edits a viral-style short video (TikTok, Reels, Shorts) with hook text, retention cuts, zoom effects, captions, and CTA. Optimized for maximum engagement under 60 seconds.",
	keywords: [
		"viral",
		"short",
		"tiktok",
		"reels",
		"shorts",
		"hook",
		"trending",
		"engagement",
		"viral video",
		"short video",
	],
	author: "system",
	instructions: `You are operating in VIRAL SHORT mode. Your goal is to transform raw footage into a high-retention short-form video optimized for TikTok, Instagram Reels, and YouTube Shorts.

${renderCreativeGating()}

## MANDATORY PRE-FLIGHT

Before making ANY edit, you MUST:
1. Call list_project_assets to discover available media and its duration
2. Call list_timeline to understand the current state
3. If the user references visual content, call load_context to analyze the footage

## ABSOLUTE RULES (NON-NEGOTIABLE)

These rules override ANY other instruction in this skill. Violating them produces a broken edit.

${renderSubtitleRules()}

5. **Voice is king.** When there is spoken content (voiceover, speech, talking head), the voice MUST be clearly audible above everything else. Music goes to ${MUSIC_WITH_VOICE_RANGE[0]} to ${MUSIC_WITH_VOICE_RANGE[1]} volume. If unsure whether voice or music should be louder, lower the music more. Mute clip audio if it doesn't contribute.

${renderVolumeModel()}

## STRUCTURE

Every viral short follows this EXACT structure. Do NOT skip any section:

### SECTION 1: THE HOOK (0-3 seconds)
This is the most critical part. If the viewer scrolls past 3 seconds, the video is dead.

**Steps:**
1. Identify the most visually striking or surprising moment in the footage
2. If the raw video starts slow, call split at 3 seconds from the best moment, then delete_timeline_elements for everything before it, then move_timeline_elements so the hook starts at 0
3. Add hook text with add_text:
    - text: A punchy, curiosity-driving phrase (max 3 words). Examples: "Wait for it...", "Nobody knows this", "This changed everything"
    - fontSize: ${TITLE_FONT_SIZE_MAX} (maximum for titles/hooks/CTA)
    - scaleX: ${TEXT_SCALE}, scaleY: ${TEXT_SCALE}
    - fontWeight: "${DEFAULT_FONT_WEIGHT}"
    - position: "center"
    - start: 0
    - end: 2.5 (do NOT exceed 3 seconds)
    - color: "${DEFAULT_TEXT_COLOR}"
    - background: { enabled: false } — NO background, ever

### SECTION 2: THE CONTENT (3s to end-3s)
This is the meat. Keep it FAST and TIGHT.

**Step 1: Remove dead air**
- Split the video at every point where there is silence or filler content
- Delete those segments using split + delete_timeline_elements
- Aim for average shot length of 3-5 seconds. If a clip is longer than 6 seconds without visual change, cut it

**Step 2: Add retention captions**
- Use generate_captions to automatically create word-timed captions for the spoken content. This tool handles timing and grouping automatically.
- Captions must be max ${MAX_WORDS_PER_CAPTION} words per element, positioned at the bottom, NO background.
- If you need manual control, use add_text with:
  - fontSize: ${CAPTION_FONT_SIZE} (recommended; acceptable range: ${CAPTION_FONT_SIZE_MIN}–${CAPTION_FONT_SIZE_MAX})
  - scaleX: ${TEXT_SCALE}, scaleY: ${TEXT_SCALE}
  - fontWeight: "${DEFAULT_FONT_WEIGHT}"
  - position: "bottom"
  - color: "${DEFAULT_TEXT_COLOR}"
  - background: { enabled: false }
  - Each caption should be 2-3 seconds long, max ${MAX_WORDS_PER_CAPTION} words per element
  - If a sentence is longer, split it across multiple add_text calls with sequential timing (back-to-back)

**Step 3: Retention zoom effects (CRITICAL for algorithm)**
Every 4-6 seconds, add a subtle zoom to prevent scrolling:
- Call upsert_keyframe on the current main clip element:
  - propertyPath: "transform.scaleX"
  - At the start of a segment: value 1.0
  - At the end of a segment: value 1.05 (subtle, not disorienting)
  - interpolation: "bezier" (smooth)
- Repeat for "transform.scaleY" with the same values

**Step 4: Visual emphasis effects**
Add these effects at key moments (not everywhere — 2-3 times max):
- For "wow" moments: apply_effect with effectType "glow" at that specific time range, params: { intensity: 0.3, radius: 5 }
- For transitions between topics: apply_effect with effectType "pixelate" for 0.3s as a transition, params: { size: 8 }
- For dramatic pauses: apply_effect with effectType "vignette", params: { intensity: 0.4 }

### SECTION 3: THE CTA (last 2-3 seconds)
End with a call-to-action that drives engagement.

**Steps:**
1. Split the video 2.5 seconds before the end
2. Add CTA text with add_text:
    - text: "Follow for more" or "Like if this helped" or topic-relevant CTA (max 3 words)
    - fontSize: ${TITLE_FONT_SIZE_MAX} (maximum for CTA)
    - scaleX: ${TEXT_SCALE}, scaleY: ${TEXT_SCALE}
    - fontWeight: "${DEFAULT_FONT_WEIGHT}"
    - position: "center"
    - start: (end - 2.5)
    - end: (video end)
    - color: "${DEFAULT_TEXT_COLOR}"
    - background: { enabled: false } — NO background, ever
3. Add a final zoom pulse via upsert_keyframe:
   - propertyPath: "transform.scaleX" — go from 1.0 to 1.08 over the CTA duration
   - Same for "transform.scaleY"

## TIMING RULES

- Total duration MUST be under 60 seconds (ideal: 30-45 seconds)
- Hook: 0-3s, no exceptions
- Each caption card: 2-3 seconds
- CTA: last 2-3 seconds
- No gaps between elements — everything must be continuous
- If the raw footage is over 60s, aggressively cut. Keep only the best 45s of content

## TEXT STYLE GUIDE

- Hook text: fontSize ${TITLE_FONT_SIZE_MAX} (max for titles), ${DEFAULT_FONT_WEIGHT} fontWeight, center, white, NO background
- Captions: fontSize ${CAPTION_FONT_SIZE} (range ${CAPTION_FONT_SIZE_MIN}–${CAPTION_FONT_SIZE_MAX}), ${DEFAULT_FONT_WEIGHT} fontWeight, bottom, white, NO background. Max ${MAX_WORDS_PER_CAPTION} words per element. Back-to-back during continuous speech.
- CTA text: fontSize ${TITLE_FONT_SIZE_MAX} (max for CTA), ${DEFAULT_FONT_WEIGHT} fontWeight, center, white, NO background
- ALL text elements: scaleX/scaleY = ${TEXT_SCALE}, NO background of any kind
- Font weight must always be "${DEFAULT_FONT_WEIGHT}" for all text elements
- NEVER add more than ${MAX_WORDS_PER_CAPTION} words per caption/subtitle element
- Hook and CTA can go up to max ${MAX_WORDS_PER_CAPTION} words as well; keep them punchy

## EFFECTS USAGE GUIDE

Use effects SPARINGLY. A viral short should feel dynamic, not chaotic:
- glow: Use 1-2 times for emphasis moments (0.3s each)
- vignette: Use once for a dramatic moment (2-3s)
- pixelate: Use once as a transition between sections (0.3s)
- sharpen: Optionally apply to the full video for clarity (params: { amount: 0.3 })
- NEVER use: blur (makes it unreadable), invert, posterize (too distracting for short form)

## ZOOM PATTERN (the secret sauce)

This is what makes shorts feel dynamic without jump cuts:

For each content segment (every 4-6 seconds):
1. upsert_keyframe: propertyPath "transform.scaleX", time at segment start, value 1.0, interpolation "linear"
2. upsert_keyframe: propertyPath "transform.scaleX", time at segment end, value 1.04-1.06, interpolation "bezier"
3. Repeat identically for "transform.scaleY"

The zoom should be imperceptible to the conscious eye but felt by the viewer. Total zoom range: NEVER exceed 1.10.

## QUALITY CHECKLIST

Before finishing, verify:
- [ ] Hook text is present at 0-2.5s with bold font, NO background
- [ ] Total duration is under 60 seconds
- [ ] At least 2 retention zooms exist on the main content
- [ ] Captions are present for spoken content (bottom, max ${MAX_WORDS_PER_CAPTION} words per element, NO background)
- [ ] CTA text is present in the last 2-3 seconds with NO background
- [ ] No gaps exist between timeline elements
- [ ] No single caption/subtitle element exceeds ${MAX_WORDS_PER_CAPTION} words
- [ ] Effects are used sparingly (max 3 total)
- [ ] If speech is present: music volume at ${MUSIC_WITH_VOICE_RANGE[0]} to ${MUSIC_WITH_VOICE_RANGE[1]}, voice clearly primary
- [ ] All text elements use scaleX/scaleY = ${TEXT_SCALE}
- [ ] No text element has a background of any kind

If any checklist item fails, fix it before responding to the user.`,
};

skillRegistry.register(viralShortSkill.id, viralShortSkill);
