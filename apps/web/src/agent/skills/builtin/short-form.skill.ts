import type { SkillDefinition } from "../types";
import { skillRegistry } from "../registry";

const shortFormSkill: SkillDefinition = {
	id: "short-form",
	name: "Short-Form",
	description:
		"Editing for vertical short-form content: TikTok, Instagram Reels, and YouTube Shorts under 60 seconds. Engineered for maximum retention through hook construction, aggressive pacing, and platform-native visual language.",
	keywords: [
		"short",
		"tiktok",
		"reels",
		"shorts",
		"vertical",
		"hook",
		"viral",
		"social",
		"60 seconds",
		"short form",
		"short-form",
		"engagement",
		"retention",
	],
	author: "system",
	instructions: `# Short-Form

## What This Is
Editing for TikTok, Instagram Reels, and YouTube Shorts — vertical video under 60 seconds built for algorithmic distribution. The format has its own grammar: hooks, fast cuts, on-screen text, and a CTA. Every second must justify its existence.

## When to Use This Skill
Use when:
- The user wants to create or adapt content for TikTok, Reels, or Shorts
- Target duration is under 60 seconds
- Content is vertical (9:16) or will be cropped for vertical
- The goal is reach and engagement over depth

Don't use when:
- The content is long-form educational (use talking-head)
- The user wants cinematic or narrative storytelling (different approach)
- Duration is over 90 seconds — this isn't a short, adapt the approach

## Mental Model
Think like a viewer with their thumb hovering over the screen. You have 2 seconds to give them a reason to stay. If they're still watching at 15 seconds, they'll probably finish. Your entire job is to clear those two thresholds.

The short-form format is not a compressed version of longer content — it's a different medium. Information density is high, patience is zero, and visual stimulation must be constant. The spoken word supports the visuals; neither can carry the full load alone.

## ⚠️ MANDATORY CREATIVE GATING

Before planning (submit_plan) or executing any edit on a short-form creative project, you MUST check whether the user has provided direction on these creative decisions:

### Required creative decisions for short-form:
1. **Subtitle position** — bottom (default) vs center vs other?
2. **Typography style** — font family and weight
3. **Text color** — white (default), yellow, or custom?
4. **Visual effects** — zoom drift, glow, vignette, or clean/no effects?
5. **Clip audio** — keep original clip audio or mute it?

### Gating rules:
- If the user has NOT addressed 3 or more of these, you MUST call ask_user BEFORE submit_plan or any direct editing.
- Ask 2–3 concrete questions max. Use the "Creative Questions" section below for exact wording.
- If the user says something like "hacelo vos", "default", "decidilo vos", "whatever you think", "I don't care" — treat ALL unanswered decisions as using the Explicit Defaults below and proceed WITHOUT asking.
- If the user already gave enough direction (e.g. "white text, bottom subtitles, no effects, mute clips"), don't ask anything — just execute.
- NEVER skip this check. Even in execute mode, if creative decisions are missing, ask_user first.

## Core Principles

**1. The hook is the whole game.**
If the opening 2–3 seconds don't create a question, tension, or surprise in the viewer's mind, the rest of the edit is irrelevant. The hook isn't a title card — it's a provocation. Analyze the footage first: find the most surprising, visually striking, or emotionally loaded moment anywhere in the clip, and lead with that.

**2. Every second must justify its place.**
Unlike long-form, there is no "setup" tolerance. If a segment doesn't advance the story, build tension, or deliver information — cut it. The bar is not "is this boring?" but "would removing this make the video worse?"

**3. On-screen text is a second audio track.**
Most viewers watch without sound. Text isn't a subtitle — it's commentary, emphasis, and punchline delivery. What the text says can complement the speech, contradict it for comic effect, or deliver the payoff before the speaker does.

**4. Visual rhythm is felt, not counted.**
Fast cuts are a tool, not a target. The editing rhythm should match the energy of the content — high-energy content wants fast cuts, emotional content wants slower ones. Cutting fast on a slow moment feels choppy; cutting slow on a high-energy moment kills the energy. Match the rhythm to the material.

**5. End with momentum, not fade-out.**
The CTA should feel like a natural extension of the content, not a commercial. The best CTAs are specific to the content ("follow for part 2", "comment your answer below") not generic ("like and subscribe").

## Explicit Defaults (when the user doesn't specify)

When the user doesn't answer creative questions or doesn't provide style details, apply these defaults without asking again:

- **Rhythm**: dynamic medium-fast — cuts every 2–4 seconds, no clip over 5–6 seconds without visual change
- **Captions**: YES if there is speech or voiceover. No captions on mute-only content
- **Subtitle position**: bottom
- **Text color**: white (#FFFFFF)
- **Font**: default (whatever fontFamily the editor uses by default)
- **Visual effects**: subtle zoom drift (1.0 → 1.04 over 4–6s) on static shots only. No glow, no vignette, no other effects unless user asked.
- **Clip audio**: MUTED by default. Original clip audio is noise — only the primary voice matters. Only unmute if the user explicitly wants the clip's original sound.
- **Text background**: NONE. All text elements have transparent background by default

## Volume Model (CRITICAL — READ THIS)

This editor uses **relative volume offsets**, NOT percentages. The semantics are:

- **0 = baseline** (no change from original volume)
- **Positive values = louder** (boost above baseline)
- **Negative values = quieter** (cut below baseline)
- **Muted = silent** (use the \`muted: true\` flag, NOT volume: -100)

### Concrete volume rules for short-form with speech:
- **Voiceover / main voice**: keep at 0 (baseline). If the voice needs a boost, use +8 to +12. Never exceed +15.
- **Background music when voice is present**: set volume to -15 to -20. The music should be barely perceptible — pure atmosphere. If unsure, go lower (-20 to -25). Too quiet is always better than too loud.
- **Clip audio (original footage sound)**: mute by default (muted: true). Only unmute if the user explicitly wants it, and even then lower it to -10 to -15 if voice is also present.
- **Music when NO speech**: can stay at 0 or go slightly positive (+3 to +5) for energy.

### NEVER use percentage language for volume.
Do NOT say "5% volume", "15% volume", "25% volume". This is WRONG for this editor. Always use the offset model: 0, +10, -15, -20, etc.

## Creative Questions (ask only when definition is missing)

These are the concrete questions you should ask via ask_user when the Creative Gating check determines decisions are missing. Pick 2–3 max — the most impactful unknowns:

- **Subtitle position**: "Los subtítulos van abajo (default) o los querés en otra posición?"
- **Text color**: "Algún color específico para los textos, o uso blanco/default?"
- **Typography**: "Tenés una fuente en mente, o uso la default?"
- **Captions**: "Querés captions/subtítulos en todo lo hablado, o solo títulos (hook + CTA)?"
- **Visual effects**: "Querés zooms sutiles o algún otro efecto visual en tomas estáticas, o limpio sin efectos?"
- **Clip audio**: "Querés que se escuche el audio original de los clips, o lo muteo y dejo solo voz/música?"

**Rules for asking**:
- Ask LITTLE. Only what changes the result
- If the user doesn't answer, use the Explicit Defaults above — don't ask again
- Never ask abstract branding questions ("what's your brand identity?") — only concrete, binary-or-pickable choices
- If the user already gave enough direction (e.g. "make it fast, white text"), don't ask anything — just execute

## Workflow

### Step 1: Audit all assets
Call list_project_assets. Understand the full footage available — main clip, B-roll, music, graphics. Call load_context on the main footage to understand the content arc. Call transcribe_audio if there is spoken content — you'll need word timing for captions.

### Step 2: Find the hook moment
Before touching the timeline, identify the single most compelling moment in the entire footage. This is where the video starts — not the chronological beginning. Candidates: the most surprising statement, the biggest visual payoff, a direct question to the viewer, a "wait for it" setup.

Once identified, restructure the timeline: move the hook moment to position 0, then assemble the rest of the content after it in logical order.

### Step 3: Ruthlessly cut for duration
Target 30–50 seconds total (under 45 is ideal). Use the transcript to find the essential narrative thread and strip everything else. Apply silence removal with aggressive thresholds — gaps over 0.3s are candidates for removal. Fast speech, no breathing room. If the raw footage is over 90 seconds, you're making editorial choices, not just trimming — identify the core idea and cut everything peripheral.

### Step 4: Add on-screen text
Every short needs at minimum: a hook text element in the first 3 seconds, and captions throughout the spoken content. Think about what each text element is doing for the viewer who has their sound off. Hook text should provoke curiosity or state the value proposition — use add_text with a large fontSize and bold fontWeight to make it visually prominent. Add emphasis text for key points (not captions — a standalone add_text element that appears on a punchline or key stat, with a larger fontSize to make it stand out).

#### CRITICAL: Subtitle Rules
When generating captions/subtitles, these rules are NON-NEGOTIABLE:

1. **Scale: ALWAYS scaleX/scaleY = 0.5.** Every text element for subtitles/captions uses scaleX: 0.5, scaleY: 0.5. No exceptions.
2. **Font size by element type:**
   - **Captions/subtitles:** fontSize 6.5 (recommended). Acceptable range: 6–8. Never exceed 8.
   - **Titles / hooks / CTA / emphasis:** fontSize max 12. These need to stand out from captions.
3. **NO background. EVER.** Subtitles must NEVER have a background color or background fill of any kind. They must be text-only — transparent background, always. If you find yourself adding a backgroundColor or backgroundStyle to ANY text element (captions, hook text, CTA text, emphasis text), stop and remove it. The ONLY exception is if the user explicitly asks for backgrounds.
4. **Max 3 words per caption/subtitle element.** Each subtitle/caption text element must contain no more than 3 words. Break longer phrases into multiple sequential elements if needed. This keeps text punchy and readable on mobile screens.

Use generate_captions to automatically create word-timed caption elements synced to the transcript — each caption should be 3 words max, positioned at the bottom, high contrast against the footage, always with scaleX/scaleY 0.5 and fontSize 6.5.

### Step 5: Control visual rhythm
Review the cut pattern. Long clips (over 5–6 seconds without a cut or visual change) need intervention: either cut, add a text element, or add a subtle scale keyframe to create movement. Use upsert_keyframe with bezier interpolation to add slow, gentle zoom drifts on static shots — this creates the sense of camera movement without actual camera movement.

### Step 6: Add CTA
The last 2–3 seconds need a clear action. Pick a CTA that's specific to this content, not generic. Add it as a text element. If there's a natural endpoint before the raw footage ends, cut there — don't pad to fill time.

### Step 7: Music and Audio Balance (if available)
Audio balance depends on whether there is spoken content. Apply the Volume Model rules from above.

**When there IS speech/voiceover (most common):**
- Voice is the priority. The viewer must hear every word clearly.
- Background music: set volume to -15 to -20 (barely perceptible, pure atmosphere).
- If in doubt about music level, go lower (-20 to -25). Too quiet is always better than music that competes with speech.
- Clip audio: mute by default (muted: true). Only the primary voice matters.

**When there is NO speech at all:**
- Music can stay at 0 or go slightly positive (+3 to +5) for energy.
- Edit cuts can follow the beat for energy.

## Tool Guidance

**load_context before planning** — You cannot plan a short-form edit without understanding the footage. The hook won't be obvious from a filename. Watch (load) before you plan.

**transcribe_audio for caption precision** — Manual caption timing is imprecise. Use word-level timing from the transcript to set caption start/end to the actual spoken word boundaries, not approximations.

**split in batch** — Every split call refreshes refs. Plan all your cut points from the transcript analysis, then execute them in as few split calls as possible.

**upsert_keyframe for zoom drift** — Static shots die on short-form. A slow 1.0 → 1.04 scale over 4–6 seconds using bezier interpolation creates life in a static frame without feeling like a zoom. Always animate both scaleX and scaleY identically.

**update_clip for volume** — Use update_clip with the volume parameter to set audio levels. Remember: 0 = baseline, negative = quieter, positive = louder. Use muted: true to fully silence clip audio.

**add_text for hook and CTA** — Use bold fontWeight for emphasis text like hooks and CTAs. For ALL text elements: ALWAYS set scaleX/scaleY to 0.5. Hook/CTA/emphasis text: fontSize max 12. Caption/subtitle text: fontSize 6.5 (range 6–8). NEVER add backgrounds to ANY text — no backgroundColor, no backgroundStyle, no background fill of any kind. Text-only with transparent background, always readable through high contrast color choice against the footage. For captions, prefer generate_captions which handles word-timing automatically.

## Common Patterns

- **Raw footage is way too long** → Don't compress linearly. Identify the one core idea the video is about. Cut everything that doesn't directly serve that idea. The edit will feel like a different video — that's correct.

- **No obvious hook moment in the footage** → Create one from the best content moment available. Reframe it: start mid-sentence at the most interesting claim the speaker makes, or open on the best visual frame. A hook can be manufactured from good raw material even if the speaker didn't record one.

- **Footage is already 45 seconds of tight content** → Focus on visual rhythm and on-screen text. The pacing work is done; the job is adding the visual layer that makes it platform-native.

- **Spoken content is too slow for short-form** → Remove silences aggressively, then consider removing filler sentences entirely. If the speaker takes 5 seconds to say something that could be said in 2, use the transcript to find the essential words and cut the rest.

## Gotchas

- Restructuring timeline order (moving hook to position 0) means audio tracks must also be moved or they'll desync. Always check all tracks after a move operation.
- On-screen text at the very start (0–0.5s) may not render in time on some platforms. Start hook text at 0.3s minimum.
- Scale keyframes for zoom drift must have matching start keyframes at value 1.0 — otherwise the element inherits its previous scale and the animation starts from an unexpected value.
- Don't add so many text elements that the screen feels cluttered. Hook text, caption cards, and one emphasis text element is usually the ceiling. More than that competes for attention.
- CTA text should not overlap with caption cards. Stagger them: captions end slightly before CTA begins, or position CTA at center/top while captions are at bottom.`,
};

skillRegistry.register(shortFormSkill.id, shortFormSkill);
