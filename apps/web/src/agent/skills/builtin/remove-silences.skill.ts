import type { SkillDefinition } from "../types";
import { skillRegistry } from "../registry";

const removeSilencesSkill: SkillDefinition = {
	id: "remove-silences",
	name: "Remove Silences",
	description:
		"Detects and removes silent segments from video or audio by transcribing first, then surgically cutting out non-speech ranges. Handles single or multiple elements, and works whether audio is embedded or on a separate track.",
	keywords: [
		"silence",
		"remove silence",
		"silencio",
		"dead air",
		"quiet",
		"gaps",
		"silencios",
		"cut silence",
		"trim silence",
	],
	author: "system",
	instructions: `# Remove Silences

## What This Does

Removes ranges where nobody is speaking from timeline elements. The source of truth is the transcript (word-level timing), not volume thresholds. This preserves natural speech cadence while eliminating dead air.

## Core Concept

A "silence" is any time range where the transcript has NO overlapping speech. You compute these as gaps between consecutive utterance segments, then split at the gap boundaries and delete the resulting silent clips.

## How to Think About It

### 1. Identify what to process

The user may specify one element, multiple elements, or just say "the video." Use list_timeline to discover the target element(s). If the user doesn't specify, target the main video/audio element.

When audio lives on a SEPARATE track from video (e.g., a detached audio track), both the video and audio elements must be split at the same timestamps to stay in sync. Identify all linked elements before proceeding.

### 2. Transcribe the source

Call transcribe_audio on the asset backing the target element(s). This returns utterances with precise start/end times in seconds.

### 3. Compute silence gaps

From the utterances array, compute the gaps — ranges where no utterance exists:

- Sort utterances by start time.
- The first silence is from 0 (or the element start) to the first utterance start.
- Between consecutive utterances: gap from utterance[i].end to utterance[i+1].start.
- The last silence is from the last utterance end to the element end.

### 4. Apply padding

Raw utterance boundaries can clip the first or last syllable of a word. Apply padding to AVOID cutting into speech:

- Round silence START times UP (later) by ~0.15-0.3s — this gives breathing room after the previous word ends.
- Round silence END times DOWN (earlier) by ~0.15-0.3s — this gives breathing room before the next word starts.

The exact padding depends on context. Fast speech needs less padding (0.1-0.15s). Slow or deliberate speech can use more (0.25-0.3s). When in doubt, be conservative — it's better to keep a bit of silence than to cut into a word.

If the rounding would make a gap zero or negative, skip it — that gap is too short to remove.

### 5. Filter by duration

Not every silence should be removed. Natural pauses between sentences (0.2-0.4s) sound fine and should usually be kept. Very short gaps are often intentional pacing. Only remove gaps that are long enough to feel like dead air. What counts as "long enough" depends on the user's intent:

- "Remove all silences" → be aggressive, remove gaps >= 0.3s
- "Remove long pauses" / "tighten it up" → only remove gaps >= 0.8-1.0s
- "Make it punchy" → remove gaps >= 0.5s

### 6. Split at gap boundaries

Collect ALL boundary times (start and end of each silence gap that passed the filter). Call split ONCE with all the times in a single batch — this is faster and more reliable than splitting one at a time.

If processing a specific element, pass its ref as target. If the audio is on a separate track, split BOTH the video and audio elements at the same times (two split calls, same times array).

CRITICAL: After splitting, the element refs change. You MUST call list_timeline again to discover the new refs before deleting anything.

### 7. Delete the silent clips

From the updated timeline, identify which clips fall entirely within the silence ranges you computed. These are the ones to delete. Call delete_timeline_elements with all their refs in one batch.

A clip falls in a silence range if its start >= silence_start AND its end <= silence_end (with your padding applied).

### 8. Close gaps (if requested)

After deletion, there will be empty space where the silent clips were. If the user wants a continuous timeline, use move_timeline_elements to shift each subsequent element left to close the gaps. Work from left to right (earliest to latest) to avoid offset calculations getting messed up.

If the user didn't ask to close gaps, leave them — some workflows prefer manual arrangement after silence removal.

## Common Patterns

**Single video with embedded audio:** Split the video element, delete silent clips, close gaps.

**Video + separate audio track:** Split BOTH elements at the same times, then delete the silent clips from both tracks. The timestamps must be identical to maintain sync.

**Multiple clips from the same source:** If the user has already cut the video into segments, transcribe the original asset (not the individual clips), compute gaps across the full duration, then apply splits relative to each clip's position within the source.

## Gotchas

- After split, refs change. Always re-read the timeline before delete.
- Padding is essential. Without it, you'll clip the first syllable of words and the edit will sound amateur.
- If the transcript returns no utterances (pure music, ambient noise), there are no speech-based silence gaps to remove. Tell the user.
- Transcription timing is word-level but not sample-perfect. A 0.15s safety margin is the minimum to avoid artifacts.`,
};

skillRegistry.register(removeSilencesSkill.id, removeSilencesSkill);
