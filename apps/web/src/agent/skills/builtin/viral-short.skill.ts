import type { SkillDefinition } from "../types";
import { skillRegistry } from "../registry";

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

## MANDATORY PRE-FLIGHT

Before making ANY edit, you MUST:
1. Call list_project_assets to discover available media and its duration
2. Call list_timeline to understand the current state
3. If the user references visual content, call load_context to analyze the footage

## STRUCTURE

Every viral short follows this EXACT structure. Do NOT skip any section:

### SECTION 1: THE HOOK (0-3 seconds)
This is the most critical part. If the viewer scrolls past 3 seconds, the video is dead.

**Steps:**
1. Identify the most visually striking or surprising moment in the footage
2. If the raw video starts slow, call split at 3 seconds from the best moment, then delete_timeline_elements for everything before it, then move_timeline_elements so the hook starts at 0
3. Add hook text with add_text:
   - text: A punchy, curiosity-driving phrase (max 6 words). Examples: "Wait for it...", "Nobody talks about this", "This changed everything"
   - style: "hook" (bold, large font)
   - position: "center"
   - start: 0
   - end: 2.5 (do NOT exceed 3 seconds)
   - color: "#FFFFFF"
   - background: { enabled: true, color: "#000000", cornerRadius: 8, padding: 12 }

### SECTION 2: THE CONTENT (3s to end-3s)
This is the meat. Keep it FAST and TIGHT.

**Step 1: Remove dead air**
- Split the video at every point where there is silence or filler content
- Delete those segments using split + delete_timeline_elements
- Aim for average shot length of 3-5 seconds. If a clip is longer than 6 seconds without visual change, cut it

**Step 2: Add retention captions**
- For each spoken segment, add caption text at the bottom:
  - style: "subtitle"
  - position: "bottom"
  - color: "#FFFFFF"
  - background: { enabled: true, color: "#000000", cornerRadius: 6, padding: 8 }
  - Each caption should be 2-3 seconds long, max 5 words per card
  - If a sentence is longer, split it across multiple add_text calls with sequential timing

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
   - text: "Follow for more" or "Like if this helped" or topic-relevant CTA
   - style: "hook"
   - position: "center"
   - start: (end - 2.5)
   - end: (video end)
   - color: "#FFFFFF"
   - background: { enabled: true, color: "#000000", cornerRadius: 8, padding: 12 }
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

- Hook text: style "hook", center, white on black rounded background
- Captions: style "subtitle", bottom, white on semi-transparent black
- CTA text: style "hook", center, white on black
- NEVER use plain text without background for any on-screen text
- Font weight must always be "bold" for all text elements
- NEVER add more than 6 words per text element

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
- [ ] Hook text is present at 0-2.5s with bold style and background
- [ ] Total duration is under 60 seconds
- [ ] At least 2 retention zooms exist on the main content
- [ ] Captions are present for spoken content (subtitle style, bottom)
- [ ] CTA text is present in the last 2-3 seconds
- [ ] No gaps exist between timeline elements
- [ ] No single text element exceeds 6 words
- [ ] Effects are used sparingly (max 3 total)

If any checklist item fails, fix it before responding to the user.`,
};

skillRegistry.register(viralShortSkill.id, viralShortSkill);
