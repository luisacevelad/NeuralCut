import type { SkillDefinition } from "../types";
import { skillRegistry } from "../registry";

const pitchVideoSkill: SkillDefinition = {
	id: "pitch-video",
	name: "Pitch Video",
	description:
		"Creates a professional pitch or explainer video with clean structure: problem statement, solution, key benefits with text cards, and call-to-action. Ideal for startups, product demos, and investor presentations.",
	keywords: [
		"pitch",
		"investor",
		"presentation",
		"startup",
		"explainer",
		"product demo",
		"elevator pitch",
		"pitch deck",
		"proposal",
	],
	author: "system",
	instructions: `You are operating in PITCH VIDEO mode. Your goal is to transform raw footage into a polished, professional pitch or explainer video with clean structure, elegant text overlays, and a clear narrative arc.

## MANDATORY PRE-FLIGHT

Before making ANY edit, you MUST:
1. Call list_project_assets to discover available media and its duration
2. Call list_timeline to understand the current state
3. If the user references visual content, call load_context to analyze the footage

## STRUCTURE

A pitch video follows this EXACT 5-act structure. Do NOT skip any section:

### ACT 1: OPENING (0-5 seconds)
Professional cold open that immediately establishes credibility.

**Steps:**
1. If the raw footage has a natural opening, use it. If not, find the most professional-looking segment
2. Add opening title text with add_text:
   - text: The project/product/company name (ask the user if not clear from context)
   - style: "hook"
   - position: "center"
   - start: 0.5
   - end: 3.5
   - color: "#FFFFFF"
   - background: { enabled: true, color: "#1a1a2e", cornerRadius: 10, padding: 16 }
3. Add a tagline or one-liner below:
   - text: One sentence that captures the value proposition
   - style: "label"
   - position: "bottom"
   - start: 1
   - end: 4
   - color: "#E0E0E0"
   - background: { enabled: false }

### ACT 2: THE PROBLEM (5s - 20s)
Clearly articulate the pain point. This builds empathy and urgency.

**Steps:**
1. Select footage that shows the problem or the user speaking about it
2. Split at appropriate boundaries to isolate this segment (5s to 20s)
3. Add a "THE PROBLEM" section header:
   - text: "THE PROBLEM" (or user's preferred phrasing)
   - style: "label"
   - position: "top"
   - start: 5
   - end: 7
   - color: "#FF6B6B"
   - background: { enabled: true, color: "#1a1a2e", cornerRadius: 6, padding: 10 }
4. Add supporting text cards that highlight key pain points (1 card per 3-4 seconds):
   - Each card: max 8 words, one key statistic or pain point per card
   - style: "subtitle"
   - position: "bottom"
   - color: "#FFFFFF"
   - background: { enabled: true, color: "rgba(0,0,0,0.7)", cornerRadius: 6, padding: 10 }

### ACT 3: THE SOLUTION (20s - 40s)
Present the product/solution with clarity and confidence.

**Steps:**
1. Transition to solution footage (split at 20s boundary)
2. Add a "THE SOLUTION" section header:
   - text: "THE SOLUTION" (or "INTRODUCING [product name]")
   - style: "hook"
   - position: "center"
   - start: 20
   - end: 23
   - color: "#FFFFFF"
   - background: { enabled: true, color: "#0f3460", cornerRadius: 10, padding: 14 }
3. Add 2-3 benefit text cards (one every 5-7 seconds):
   - Each card states ONE clear benefit, max 8 words
   - style: "label"
   - position: "bottom"
   - color: "#FFFFFF"
   - background: { enabled: true, color: "rgba(15,52,96,0.85)", cornerRadius: 6, padding: 10 }
4. For each benefit card, add a subtle scale animation via upsert_keyframe:
   - propertyPath: "transform.scaleX"
   - time 0: value 0.95, interpolation "bezier"
   - time 0.3: value 1.0, interpolation "linear"
   - Repeat for "transform.scaleY" with same values
   This creates a professional "pop-in" effect for each text card

### ACT 4: KEY NUMBERS (40s - 50s)
Social proof and data build trust.

**Steps:**
1. Add 1-2 text cards with impressive metrics (user should provide these, or infer from context):
   - Examples: "10x faster", "50% cost reduction", "Used by 10,000+ teams"
   - style: "hook"
   - position: "center"
   - color: "#4ECDC4"
   - background: { enabled: true, color: "#1a1a2e", cornerRadius: 10, padding: 14 }
   - Each metric card: 3-4 seconds
2. Add scale-up animation on these cards via upsert_keyframe:
   - propertyPath: "transform.scaleX"
   - time 0: value 0.8
   - time 0.4: value 1.05
   - time 0.5: value 1.0
   - interpolation: "bezier"
   - Repeat for "transform.scaleY"

### ACT 5: THE CTA (last 5 seconds)
End with a clear, confident call-to-action.

**Steps:**
1. Split 5 seconds before the end
2. Add CTA text:
   - text: "Let's talk" or "Book a demo" or "Invest in [name]"
   - style: "hook"
   - position: "center"
   - start: (end - 4.5)
   - end: (end - 0.5)
   - color: "#FFFFFF"
   - background: { enabled: true, color: "#0f3460", cornerRadius: 10, padding: 14 }
3. Add contact info text below:
   - text: Website URL or email (ask user if not provided)
   - style: "plain"
   - position: "bottom"
   - start: (end - 4)
   - end: (end - 0.5)
   - color: "#CCCCCC"
   - background: { enabled: false }

## TIMING RULES

- Ideal total duration: 60-90 seconds (can extend to 120s for investor pitches)
- Opening: 0-5s
- Problem: 5-20s (15 seconds max)
- Solution: 20-40s (20 seconds max)
- Key Numbers: 40-50s (10 seconds)
- CTA: last 5 seconds
- Each text card: 3-5 seconds
- No gaps — every second should have either footage or a text element

## TEXT STYLE GUIDE (professional, NOT flashy)

This is a PITCH. Clean, confident, professional. No gimmicks.

- Section headers ("THE PROBLEM", "THE SOLUTION"): style "label", position "top" or "center", dark navy background (#1a1a2e or #0f3460)
- Benefit/statistic cards: style "label" or "hook" (for emphasis), position "bottom" or "center"
- CTA: style "hook", center, confident navy background
- Color palette:
  - Primary text: #FFFFFF (white)
  - Emphasis text: #4ECDC4 (teal) for key numbers
  - Problem text: #FF6B6B (coral) for pain points only
  - Backgrounds: #1a1a2e (dark navy), #0f3460 (navy blue), rgba(0,0,0,0.7) (semi-transparent black)
  - Subtitle text: #E0E0E0 (light gray) for secondary info
- ALL text must have a background. NO floating text without a backing shape
- Font weight: "bold" for headers and numbers, "normal" for subtitle lines
- NEVER use more than 10 words per text card
- NEVER use flashy colors (no neon, no yellow, no red except for problem section)

## EFFECTS USAGE (minimal and professional)

Pitch videos use effects to ENHANCE clarity, never to distract:

- sharpen: Apply to the FULL video duration for crisp visuals, params: { amount: 0.25 }
- vignette: Optional, apply once during the key numbers section for subtle focus, params: { intensity: 0.2 }
- brightness-contrast: If footage looks flat, apply across the full duration, params: { brightness: 5, contrast: 10 }

NEVER use:
- glitch, pixelate, wave, chromatic-aberration (too chaotic for professional context)
- glow, halftone, scanlines (too flashy)
- sepia, duotone, cross-process (changes color perception — misleading for pitch)

## TRANSITION PATTERN

Between each act, use a subtle opacity fade on the section header:
- upsert_keyframe on the text element's "opacity" propertyPath:
  - time 0: value 0 (invisible)
  - time 0.3: value 1 (fully visible)
  - time (duration - 0.3): value 1 (still visible)
  - time (duration): value 0 (faded out)
  - interpolation: "bezier"

This gives a professional fade-in/fade-out on each text card.

## QUALITY CHECKLIST

Before finishing, verify:
- [ ] Opening title with product/project name at 0.5-3.5s
- [ ] "THE PROBLEM" section header exists with coral accent
- [ ] At least 2 pain point text cards in the problem section
- [ ] "THE SOLUTION" section header with navy background
- [ ] At least 2 benefit text cards in the solution section
- [ ] At least 1 key metric/number with teal emphasis
- [ ] CTA text in the last 5 seconds with navy background
- [ ] Contact info text below CTA
- [ ] All text has backgrounds (no floating text)
- [ ] Effects are limited to sharpen/vignette/brightness only
- [ ] Fade-in/fade-out animations on section headers
- [ ] Total duration is between 60-120 seconds
- [ ] Color palette is consistent (navy backgrounds, white/teal/coral text)

If any checklist item fails, fix it before responding to the user.`,
};

skillRegistry.register(pitchVideoSkill.id, pitchVideoSkill);
