import type { SkillDefinition } from "../types";
import { skillRegistry } from "../registry";

const captionGuideSkill: SkillDefinition = {
	id: "caption-guide",
	name: "Caption Guide",
	description:
		"Reference guide for creating clean, modern captions using transcribe_audio + batched add_text. Covers styling, word grouping, timing, and gap handling.",
	keywords: [
		"captions",
		"subtitles",
		"sub",
		"cc",
		"caption",
		"subtitle",
	],
	author: "system",
	instructions: `# Caption Guide

Use transcribe_audio first to get word-level timing (reuse existing transcription if available). Use the \`words\` array with word-level timing to build captions, then insert them all in a single batch add_text call (\`texts\` array).

## Style
- fontSize: 6.5 (recommended; acceptable range: 6–9), scaleX: 0.5, scaleY: 0.5, fontWeight: "bold"
- fontFamily: pick something fitting — "Vend Sans" works well. Never Arial.
- background: { enabled: false }. No boxes. No backgrounds on ANY text element. White text directly on footage. The ONLY exception is if the user explicitly asks for backgrounds.
- Position at bottom of frame.

## Grouping
- Max 3 words per caption element. This is NON-NEGOTIABLE.
- Break at natural phrase boundaries (commas, periods), not mid-clause.
- Short connector words ("y", "el", "the", "a") stay attached to the next word group, never start alone.

## Timing
- Each caption: start = first word start − 0.15s, end = last word end + 0.2s.
- Continuous speech → captions back-to-back, no gaps between them.
- Silence gaps (>0.5s) → no caption. Don't stretch captions into silence.

## Delivery
- Use add_text batch mode (\`texts\` array). One call for all captions, never one-by-one.
- After insertion, review: if a grouping reads awkwardly or splits an idea, adjust with update_text.`,
};

skillRegistry.register(captionGuideSkill.id, captionGuideSkill);
