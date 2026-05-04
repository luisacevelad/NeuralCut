import type { SkillDefinition } from "../types";
import { skillRegistry } from "../registry";

const bRollNarrativeSkill: SkillDefinition = {
	id: "b-roll-narrative",
	name: "B-Roll Narrative",
	description:
		"Editing for footage-driven storytelling where visuals carry the narrative: documentaries, brand films, travel videos, and content where B-roll is the primary layer and voiceover or music drives the emotional arc.",
	keywords: [
		"b-roll",
		"documentary",
		"cinematic",
		"brand film",
		"travel",
		"narrative",
		"voiceover",
		"storytelling",
		"atmospheric",
		"footage",
		"visual storytelling",
	],
	author: "system",
	instructions: `# B-Roll Narrative

## What This Is
Editing for visually-driven content where footage carries the story — documentaries, brand films, travel videos, mini-docs, and any format where B-roll is the primary visual layer. Voiceover, interview audio, or music drives the emotional arc while images illustrate, contrast, or deepen the meaning.

## When to Use This Skill
Use when:
- The user has a collection of B-roll footage to assemble into a narrative
- There's a voiceover track or interview audio that acts as the narrative spine
- The content is atmospheric or story-driven, not directly instructional
- The feel target is cinematic, emotional, or journalistic

Don't use when:
- A person speaking to camera is the primary content (use talking-head)
- The content is short-form social media (use short-form)
- The content is primarily screen recordings or presentations (different approach)

## Mental Model
Think like a documentary editor. You have two layers running simultaneously: what is being said or felt (the audio narrative), and what is being shown (the visual narrative). Your job is to make these two layers interact meaningfully — not just illustrate the words literally, but sometimes contrast them, anticipate them, or let the visuals carry an emotion the audio doesn't explicitly state.

The edit is built from the audio out. The voiceover or interview audio is laid first; the visuals are cut to fit and enhance it, not the other way around.

## Core Principles

**1. Audio is the spine, visuals are the flesh.**
Start from the audio narrative. Understand its structure, its emotional beats, its pacing. Every visual cut decision is made in service of the audio, not independently. A cut that makes perfect visual sense but disrupts the audio rhythm is wrong.

**2. Illustrate ideas, not words.**
When the voiceover says "the city was overwhelming," don't necessarily cut to the city — cut to something that feels overwhelming: a crowd, moving traffic, a face in the middle of it. The relationship between word and image can be literal, metaphorical, or contrapuntal. Literal is the least interesting option.

**3. Shot length is an emotional tool.**
Long, lingering shots create contemplation, unease, or grandeur. Fast cuts create energy, confusion, or excitement. Match the shot rhythm to the emotional intention of each segment, not to a consistent metronome.

**4. Transitions carry meaning.**
A hard cut says "and then." A slow dissolve says "time passed" or "these things are connected." Don't use transitions randomly — use them intentionally when they carry a meaning a cut doesn't.

**5. Let visuals breathe at key moments.**
Don't cut on every beat of the voiceover. Some statements deserve a long visual hold — a landscape, a face, a detail shot — that lets the viewer sit with what they just heard. Over-cutting a documentary is as bad as under-cutting a short.

## Workflow

### Step 1: Understand the full asset inventory
Call list_project_assets to see everything available — voiceover tracks, interview clips, all B-roll footage, music. Use load_context on the voiceover or primary audio asset to understand the narrative structure: what is the story arc? What are the emotional peaks? Where does it begin and end?

If the audio is an interview or spoken content rather than a clean voiceover, call transcribe_audio to get precise timing and identify the key soundbites.

### Step 2: Build the audio spine first
Add the voiceover or interview audio to the timeline as the foundation. If there are multiple audio segments (interview soundbites, multiple voiceover takes), assemble them in narrative order first — this is your edit backbone.

If there's background music, add it at ~-15 dB now. It will influence the emotional pacing decisions you make for the visuals.

### Step 3: Map the narrative structure
Before placing any B-roll, identify the segments of the audio narrative:
- What is each section about? (What idea is being communicated?)
- What is the emotional quality of each section? (Hopeful, tense, reflective, energetic?)
- Are there transition moments between sections?

This map is your B-roll placement guide.

### Step 4: Select and place B-roll
Call list_project_assets with filter 'unused' to see available B-roll. For each narrative segment, use load_context to evaluate candidate B-roll assets against the criteria: does this footage serve the idea AND the emotional quality of this segment?

Add B-roll as overlays above the audio track. Cut B-roll to match the audio rhythm — cuts should generally happen at sentence breaks, beats in the music, or moments of emphasis in the voiceover. Vary shot lengths: mix wide establishing shots with close details.

Cover the entire audio track with visuals — there should be no moments where the screen is empty (unless intentional black).

### Step 5: Refine the rhythm
Review the assembled edit. Look for:
- Shots that overstay their welcome (cut if the visual information is exhausted before the shot ends)
- Moments that feel rushed (extend the shot or add a hold)
- Sections where all shots are the same type (break up with a contrasting shot — wide after close-up, static after moving, etc.)

### Step 6: Effects and motion
For static shots that need energy, add slow scale or position keyframes using upsert_keyframe — a gentle pan or zoom over 3–5 seconds creates the sense of camera movement. Use bezier interpolation for smooth, cinematic motion. Never use abrupt or fast artificial movement — this style demands restraint.

Use apply_effect sparingly: vignette on emotionally heavy moments (low intensity), sharpen for footage that feels soft. Don't apply effects uniformly — use them at specific moments where they serve a purpose.

### Step 7: Music balance
If music is present, adjust its volume based on whether there is spoken content:

**During voiceover/interview audio:**
- Music at ~-15 dB — present but never competing with speech. The voice MUST be clearly primary.
- If in doubt about the level, lower the music further. Voice clarity always wins.

**During visual-only segments (no voiceover):**
- Music can rise to carry the emotional weight and rhythm.

Use volume keyframes on the music element if the balance needs to shift dynamically throughout the piece.

## Tool Guidance

**load_context on B-roll assets** — Essential before placing footage. Filename tells you nothing about the visual content or quality of a shot. Always preview before placing. Evaluate: composition, lighting, motion quality, emotional tone.

**transcribe_audio for interview content** — When the audio source is an interview rather than clean voiceover, use transcription to identify which soundbites are most powerful. The transcript reveals what was actually said and when — you can't select soundbites reliably from load_context alone.

**upsert_keyframe for camera simulation** — Static footage gains life from simulated camera movement. Use it selectively: not every shot needs motion. Reserve artificial movement for shots that would otherwise feel too static given their duration.

**add_media_to_timeline with precise startTime** — B-roll placement timing matters. The startTime should align with the moment in the voiceover it's meant to illustrate or support. Don't drop B-roll at round numbers — place it where it belongs narratively.

## Common Patterns

- **Too much B-roll of one type (e.g., all wide shots)** → Interrupt with a close-up detail or an abstract shot. Visual variety is not optional — the eye needs change to stay engaged.

- **A powerful audio moment with no matching B-roll** → Let the best available footage hold longer over that moment. A great landscape or a strong face can carry a lot of emotional weight if given enough time. Don't rush past important audio to show more footage.

- **Voiceover and available B-roll don't match thematically** → Look for thematic or emotional parallels, not literal ones. A voiceover about uncertainty can be illustrated by fog, a person waiting, an empty road — anything that feels uncertain. Abstract is often better than mismatched literal.

- **Multiple takes of the same interview question** → Transcribe all takes, identify the best delivery of each key statement, and cut between takes mid-sentence if needed. Use a cutaway (B-roll) over the cut point to hide the splice.

## Gotchas

- B-roll on overlay tracks must cover the exact timeline range you intend — if the overlay starts 0.2s late, there will be a flash of the underlying (empty) layer. Always check coverage after placing.
- Artificial camera movement (keyframed scale/position) must be gentle. If it's perceptible as artificial, it breaks the cinematic feel. Test: if the viewer notices the zoom, it's too fast.
- Music cuts at the end of the piece should never be abrupt — fade out the music track over the last 2–3 seconds using volume keyframes. An abrupt music end is one of the most noticeable editing mistakes.
- If using interview soundbites, never cut in the middle of a word. Always cut between words, with a slight gap after the last consonant of the previous word.
- Don't over-effect. One vignette, one sharpen pass, maybe one other effect for the whole piece. More than that starts to feel processed rather than cinematic.`,
};

skillRegistry.register(bRollNarrativeSkill.id, bRollNarrativeSkill);
