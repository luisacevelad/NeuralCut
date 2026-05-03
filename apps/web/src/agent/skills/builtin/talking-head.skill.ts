import type { SkillDefinition } from "../types";
import { skillRegistry } from "../registry";

const talkingHeadSkill: SkillDefinition = {
	id: "talking-head",
	name: "Talking Head",
	description:
		"Editing for single-camera speaking footage: YouTube videos, explainers, tutorials, vlogs, and interviews where one person speaks directly to camera. Focuses on pacing, silence removal, and supporting the spoken narrative with B-roll and captions.",
	keywords: [
		"talking head",
		"youtube",
		"vlog",
		"tutorial",
		"explainer",
		"interview",
		"speaking",
		"camera",
		"presenter",
		"lecture",
		"educational",
	],
	author: "system",
	instructions: `# Talking Head

## What This Is
Editing for footage where one person speaks to camera as the primary content — YouTube videos, tutorials, vlogs, explainers, and interviews. The spoken word is the story; your job is to make the delivery feel tight and natural without losing the speaker's voice and cadence.

## When to Use This Skill
Use when:
- The main asset is a single-camera recording of someone speaking
- The content is informational, educational, or narrative-driven
- The user wants to "clean up" or "tighten" their video
- There are multiple takes or segments to assemble

Don't use when:
- The footage is primarily B-roll with voiceover (different workflow)
- The content is under 60s and meant for social platforms (different pacing)
- It's a multi-guest podcast with split screen (different setup)

## Mental Model
Think of yourself as a radio producer who also has visuals. The transcript is the backbone — every edit decision starts from the words. If a moment wouldn't survive as audio alone, it probably shouldn't survive the edit. Visuals support and reinforce the spoken content; they never compete with it.

The goal is a speaker who sounds confident, well-paced, and sharp — even if the raw footage had filler words, long pauses, and restarts.

## Core Principles

**1. Pacing comes from speech, not from preset cut rates.**
Don't target a fixed cut frequency. The natural rhythm of the speaker's sentences defines where cuts belong. Some ideas deserve breathing room. Cut when the content shifts, not on a timer.

**2. Silence is not always the enemy.**
A pause before a key point lands harder than cutting it. A beat between two ideas gives the viewer time to absorb. Remove dead air that has no function; preserve pauses that have weight.

**3. Jump cuts need coverage or they look like mistakes.**
When you remove a silence or a restart, the speaker's position jumps on screen. This only feels intentional if covered by B-roll, text, or a subtle zoom. Never leave a bare jump cut unless the style calls for it explicitly.

**4. The speaker's voice should sound like them.**
Aggressive trimming can make someone sound choppy, breathless, or robotic. After editing, the delivery should feel natural — as if they just spoke it that way the first time.

**5. Captions multiply reach, not just accessibility.**
Most people watch without sound. Captions are not optional — they're a distribution strategy.

## Workflow

### Step 1: Understand what you have
Call list_project_assets to see all available media. Call list_timeline to understand the current state. If the user has multiple video files (multiple takes, multiple segments), identify which are main camera and which are B-roll.

### Step 2: Analyze the main footage
Call load_context on the main speaking asset to understand the content, structure, and where key ideas live. If you need precise timing for words (for subtitle sync or cut points), call transcribe_audio.

### Step 3: Build the base cut
If the main footage is not yet on the timeline, add it. If there are multiple takes, identify the best segments from each using the transcript and visual analysis, then assemble them in sequence. At this stage, don't worry about jump cuts — focus on getting the right content in the right order.

### Step 4: Remove dead air and fix pacing
Using the transcript utterances, compute gaps between consecutive utterance end and next utterance start. Apply ~0.15s padding to boundaries to avoid clipping syllables. Filter out short gaps (<0.3s) that serve as natural pauses — only remove gaps long enough to feel like dead air. Split at all gap boundaries in one batch, re-read the timeline to get updated refs, then delete the silent clips in one batch.

Be conservative — tight but not breathless. After deletion, close the gaps with move_timeline_elements to create a continuous main track.

### Step 5: Cover jump cuts with B-roll
After removing silences, list_project_assets with filter 'unused' to discover available B-roll. For each visible jump cut on the main track, identify what the speaker is talking about at that moment. Pick a B-roll asset that relates to the topic, not just any asset. Add it as an overlay above the main clip for the duration of the jump cut — the B-roll should start slightly before and end slightly after the cut so the transition is invisible.

If no relevant B-roll exists for a jump cut, consider adding a subtle zoom keyframe on the main clip around the cut point to mask the position shift visually.

### Step 6: Add captions
Use the **generate-captions** skill workflow: group transcribed words into 4-word chunks, create text elements in a single batch add_text call with fontSize: 8, scaleX: 0.5, scaleY: 0.5, fontFamily: "Vend Sans", no background, positioned at bottom. Ensure captions are back-to-back in continuous speech with no gaps, but do not extend captions into silence. Each caption's timing comes from the actual word boundaries (first word start - 0.15s to last word end + 0.2s).

### Step 7: Supporting elements (if needed)
If the content has distinct sections, consider adding a brief text label at section transitions using add_text with appropriate fontSize and fontWeight (position 'top') so viewers can follow the structure. Only add these if the content genuinely has navigable sections — don't force structure that isn't there.

## Tool Guidance

**transcribe_audio** — The most important tool in this skill. Use it early. Word-level timing is what makes precise silence detection and caption sync possible. Don't try to guess cut points from load_context alone.

**load_context on B-roll assets** — Before placing B-roll, load context on the candidate asset to verify it matches the spoken topic at that moment. Don't place B-roll blindly by filename.

**split** — Always batch your split times into a single call. Splitting one at a time is slow and causes ref churn that requires extra list_timeline calls.

**upsert_keyframe for zoom masking** — When covering a jump cut without B-roll, a very subtle scale keyframe (1.0 → 1.03 over 0.3s around the cut) makes the position shift imperceptible. Use bezier interpolation. Don't exceed 1.05 total scale — it becomes noticeable.

**generate-captions skill for captions** — Follow the generate-captions skill workflow: batch add_text with word-level timing from transcription, fontSize 8, scale 0.5, Vend Sans font, no background, max 4 words per element. Single batch call for all captions — never one-by-one.

**add_text for section labels** — When adding section labels or emphasis text, use fontSize and fontWeight directly to control appearance. Never add more words than can be read in the element's duration.

## Common Patterns

- **Rambling intro that doesn't get to the point** → Use load_context to identify when the actual content starts. Trim everything before the first substantive sentence. After editing, briefly mention what you trimmed so the user can undo if they disagree.

- **Speaker restarts a sentence mid-take** → Transcription reveals this as duplicate content at the word level. Identify the best take of the sentence (usually the second attempt), split at the restart and the clean start, delete the false start, close the gap, add B-roll if the cut is visible.

- **Multiple B-roll assets but none obviously match** → Look for visual themes, not literal matches. If the speaker says "this process takes weeks," any footage showing patience, waiting, or work in progress serves better than leaving a jump cut.

- **No B-roll available at all** → Use subtle zoom keyframes to cover cuts, and rely on text elements (captions, section labels) to maintain visual engagement.

## Gotchas

- After splitting, refs change. Always re-call list_timeline before batch-deleting — this is the most common source of errors.
- Transcription timing has slight drift at segment boundaries. Add 0.1–0.15s of padding to every cut point to avoid clipping syllables.
- B-roll on an overlay track should match the audio track below it. If the main clip has been trimmed, the overlay timestamps must reflect the trimmed timeline position, not the source asset position.
- Don't caption music or ambient sound — only caption speech. If there's background music during speech, captions still go on.
- Avoid putting B-roll over moments where the speaker makes an important facial expression or gesture. Sometimes the talking head IS the visual.`,
};

skillRegistry.register(talkingHeadSkill.id, talkingHeadSkill);
