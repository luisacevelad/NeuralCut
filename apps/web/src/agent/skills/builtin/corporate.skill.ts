import type { SkillDefinition } from "../types";
import { skillRegistry } from "../registry";

const corporateSkill: SkillDefinition = {
	id: "corporate",
	name: "Corporate / Explainer",
	description:
		"Editing for professional business content: product demos, company presentations, explainer videos, internal communications, and branded content. Prioritizes clarity, structure, and professional visual identity using whatever branded assets the user has uploaded.",
	keywords: [
		"corporate",
		"explainer",
		"business",
		"presentation",
		"product demo",
		"demo",
		"professional",
		"company",
		"brand",
		"marketing",
		"internal",
		"communication",
		"promo",
		"promotional",
	],
	author: "system",
	instructions: `# Corporate / Explainer

## What This Is
Editing for professional business content — product demos, explainers, company presentations, internal communications, and brand videos. The priority is clarity, credibility, and structure. Every element should feel intentional and on-brand. The viewer should finish the video knowing exactly what the key message was.

## When to Use This Skill
Use when:
- The content serves a business purpose (selling, informing, training, presenting)
- Professional credibility matters — the output represents a company or brand
- There's a clear informational or persuasive message to deliver
- The user has uploaded branded assets (logos, intro/outro, slides, branded templates)

Don't use when:
- The content is purely entertainment or social (use short-form)
- The content is a personal vlog or YouTube tutorial (use talking-head)
- The content is primarily B-roll storytelling with no structured message (use b-roll-narrative)

## Mental Model
Think like a brand designer, not a filmmaker. Every edit decision should reinforce clarity and professionalism. The viewer is often watching this as part of a decision-making process — evaluating a product, following a training, reviewing a proposal. They need to understand the message quickly, trust the source, and remember the key points.

Creativity serves structure here, not the other way around. A surprising edit choice that undermines clarity is a mistake, even if it's visually interesting. The goal is confident, clean, and credible.

## Core Principles

**1. Clarity over style.**
If there is ever a choice between a visually interesting edit and a clear one, choose clarity. The viewer's time is limited. The message must land without effort. Every element on screen — text, effects, transitions — should help the viewer understand, not require them to interpret.

**2. Audit the asset library first — always.**
The user may have uploaded branded intros, outros, logo bugs, background music, slide assets, lower thirds templates, or product footage. Call list_project_assets and use load_context to identify everything available before planning. A corporate edit built from the user's own assets will always feel more professional than one that doesn't use them. Never assume the asset library is empty.

**3. Structure is visible.**
Corporate content has sections: intro, point 1, point 2, point 3, conclusion. These sections should be visually communicated — through text labels, title cards, or clear transitions — so the viewer always knows where they are in the narrative.

**4. Lower thirds and text are functional, not decorative.**
Every text element should serve one of: identify someone, label a section, reinforce a key claim, or communicate a call to action. Don't add text for visual interest. Add text because the viewer needs the information.

**5. Consistency is professionalism.**
Use the same text styles throughout. If you use a label style for section headers, use it for all section headers. If the brand has a color, that color should appear consistently across text elements. Inconsistency reads as amateur regardless of production quality.

## Workflow

### Step 1: Full asset audit
This step is non-negotiable. Call list_project_assets — not just for the main footage, but for everything: audio, images, overlays, graphics. Call load_context on any non-obvious assets to understand what they are. Specifically look for:
- Intro / outro clips (branded video bookends)
- Logo files (image assets to use as overlay)
- Background music (corporate ambient tracks)
- Slide exports or presentation screenshots
- Lower third templates or graphics
- Product footage vs. presenter footage

Make a mental inventory: what branded elements can anchor this edit?

### Step 2: Understand the message structure
Call load_context on the main footage and call transcribe_audio on any spoken content. Identify the content's structure:
- What is the opening hook / value proposition?
- What are the 2–4 key points being made?
- What is the call to action or conclusion?

This structure will directly map to the visual structure of the edit.

### Step 3: Build the framework
Assemble the core structure on the timeline:
1. If there's a branded intro clip: place it first at position 0.
2. Place the main content footage after the intro.
3. If there's a branded outro: place it at the end, after the main content.
4. Add background music as an audio track at low volume (volume: -15 to -20 during speech; 0 during non-speech sections). It should be present but never distracting.

This gives you the skeleton. Everything else fills in around it.

### Step 4: Clean up the main content
Remove silences and filler from the main footage using transcript-based gap detection. For corporate content, be conservative with cuts — a slightly slower pace reads as confident and deliberate. Aggressive silence removal can make the speaker sound rushed or nervous. Target gaps over 1.0s for removal; shorter pauses are natural and fine.

Cover any visible jump cuts with relevant B-roll (product shots, slides, supporting footage) or with a text overlay that fills the frame at that moment.

### Step 5: Add structure through text
Map the section breaks you identified in Step 2 to title card moments. For each major section transition:
- Add a brief text element (1.5–2.5s) that names the section using add_text with appropriate fontSize and fontWeight (position: 'top' or 'center' as appropriate)
- This gives the viewer a clear signal that a new topic is beginning

For speaker identification (if this is an interview or presentation with a named presenter): add a lower third text element in the first appearance of each speaker (name, title). Display it for 3–4 seconds, then let it disappear. Don't show it the entire time the person is on screen.

For key claims or statistics that the speaker states: consider adding an emphasis text element that appears during the statement and echoes the key number or phrase. This reinforces retention.

### Step 6: Logo and brand placement (if logo available)
If a logo image asset is available, add it as a persistent overlay in a corner of the screen (typically top-right or bottom-right, positioned using positionX/positionY). Set its opacity to around 70–80% — visible but not competing with the content. Size it appropriately using scaleX/scaleY so it's recognizable without being distracting.

The logo can appear throughout the video, or only during specific sections (intro, outro, key moments) — use judgment based on how prominently branded the content needs to be.

### Step 7: Product or supporting footage
If product footage or screen recording assets are available, place them as overlays or main track elements at the moments in the speech where that product or feature is being discussed. The alignment should be precise — the viewer should see the product exactly when the speaker mentions it, not 2 seconds before or after.

### Step 8: Music balance and closing
Ensure background music is appropriately balanced. This editor uses **relative volume offsets**: 0 = baseline, positive = louder, negative = quieter. Use update_clip with the volume parameter.

During speech: music at -15 to -20 (firmly in the background). During non-speech sections (intro, outro): music can rise to 0 or slightly positive (+3 to +5) but should remain professional in character.

At the outro: if no branded outro clip is available, fade to black with the music fading out over 1.5–2 seconds using volume keyframes (animate from current level to -50 or lower). If a branded outro exists, let it play in full — don't cut it short.

## Tool Guidance

**list_project_assets (filter: 'unused')** — After building the main structure, check what assets you haven't used yet. In corporate editing, every uploaded asset is probably intentional. If there's an unused image file that looks like a slide or a logo, use it.

**load_context on ALL non-footage assets** — Don't assume you know what a file is from its name. A file named 'background.mp4' might be a branded intro, a lower third template, or a product B-roll. Load it before deciding whether and where to use it.

**update_clip for logo overlay** — Use positionX/positionY to place the logo in a corner, scaleX/scaleY to size it appropriately, and opacity to prevent it from competing with content. Always call get_element after placement to verify the values are applied correctly.

**add_text for lower thirds** — Lower thirds (name + title cards) should appear for 3–4 seconds in the speaker's first appearance. Use add_text with a medium fontSize and bold fontWeight, positioned at the bottom with positionY adjusted to sit in the lower third of the frame (positionY around 30–35). A background with moderate padding reads well against any footage.

**apply_effect sparingly** — Corporate content doesn't benefit from effects. If you use anything, a subtle vignette on the intro/outro section can add polish. Sharpen can help if the footage is soft. Nothing more — effects draw attention to themselves and undermine the professional feel.

## Common Patterns

- **User uploaded slides as image files** → These are meant to be shown at the moments the speaker references them. Use load_context to understand what each slide covers, match it to the transcript at the moment the speaker discusses that topic, and add it as a fullscreen overlay for the duration of that discussion.

- **No branded assets at all, raw footage only** → Build professionalism through consistency: use the same text style throughout, clean section labels, conservative pacing, and no unnecessary effects. A simple, well-structured edit with consistent typography reads professional even without brand assets.

- **Multiple presenters / interview format** → Each presenter gets a lower third in their first appearance. If cutting between presenters, use their name consistently in lower thirds so the viewer always knows who is speaking.

- **Product demo footage with no explanation** → Use load_context to understand what the product footage shows. Add explanatory text elements that label what the viewer is seeing at each moment ("Automatic sync across devices", "One-click export"). The text carries the narrative that the demo footage can't explain itself.

## Gotchas

- For on-screen text, choose appropriate fontSize and fontWeight for the context: large bold text for section headers and emphasis, medium weight for lower thirds, clean readable sizing for captions. Avoid flashy or overly large text — corporate content should feel understated and professional.
- Logo overlays must not cover important content areas. Check the footage first — if the speaker's face or the product demonstration occupies the corner where you'd place the logo, move the logo to a different corner or suppress it for those sections.
- Music choice matters — if the user hasn't uploaded music, don't add music from nowhere. Ask the user what tone they want before adding a background track.
- Corporate audiences are often watching on desktop, not mobile. Don't over-optimize for vertical or mobile layout. Keep text sizes readable on a monitor at a normal viewing distance.
- Silence removal should be conservative. A confident executive pause before making a point should not be removed — it reads as authority. Remove only genuinely dead air, not deliberate pacing.`,
};

skillRegistry.register(corporateSkill.id, corporateSkill);
