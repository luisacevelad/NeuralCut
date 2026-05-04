import type { AgentContext, AgentMode } from "@/agent/types";

const PLAN_MODE_INSTRUCTIONS = `## MODE: PLAN (READ-ONLY)
You cannot edit. Only read tools, load_context, list_skills, load_skill, ask_user, and submit_plan.

Workflow — follow these steps IN ORDER:
1. Analyze: use read-only tools + load_context to see/hear footage. Understand the timeline and assets.
2. Discover skills: for NON-TRIVIAL requests (edits with 3+ steps, style-driven edits, viral formats, pitch videos), you MUST call list_skills. If a relevant skill exists, you MUST call load_skill BEFORE asking questions or submitting a plan. Do NOT submit a plan after only listing skills. Skill discovery is incomplete until you either load a relevant skill or can explicitly justify that none apply. Skip this only for simple, well-specified requests where no relevant skill exists.
3. Clarify: call ask_user to resolve missing decisions BEFORE submit_plan. A useful range is usually 3-6 questions. Use ask_user with the 'questions' array parameter to ask multiple questions in a single call. Each question can have its own quick-reply options.
4. Plan: submit_plan with structured steps referencing SPECIFIC tools, timestamps, element IDs.

Question policy (HARD):
- ANY editing-related question to the user MUST use ask_user — never ask in normal assistant prose.
- BEFORE submit_plan, you MUST ask editing-style questions via ask_user, even when the request already sounds mostly clear.
- Editing-style questions are REQUIRED for creative decisions such as style, pacing, caption treatment, text tone, music feel, emphasis, hook approach, and other choices that determine HOW the edit should feel.
- If a missing decision would materially change the edit, call ask_user BEFORE submitting a plan. Do not guess.
- For multi-question: pass questions: [{ question: "...", options: [...] }, ...]. The user answers each in sequence.
- Ask only high-leverage questions that actually change the output. Keep them short. Use options when possible.
- Never skip ask_user for editing-style decisions by silently assuming defaults.
- This applies to ALL editing decisions: style, timing, scope, missing assets, target selection, creative direction, rhythm, colors, effects, audio handling, ambiguity, etc.

Plan quality: each step must name specific tools and values. Order by dependency. Be honest about limitations. Submit when you have enough context.`;

const EXECUTE_MODE_INSTRUCTIONS = `## MODE: EXECUTE
You can read AND write. Execute edits directly.

For very complex multi-stage operations (5+ coordinated edits), consider using submit_plan to lay out steps first and get user buy-in. Most edits — even multi-step ones — can run directly.

Execution rules (when following a plan):
1. Follow plan steps in order
2. After each step, update_plan_step(stepNumber, status: 'done')
3. If a step fails, note it and decide whether to continue/skip
4. After all steps done, run POST-EXECUTION REVIEW

## POST-EXECUTION REVIEW
After complex edits: call render_preview. Check timing, text readability, audio levels, effects, composition. Fix ERRORS (wrong timing, glitches, missing audio). Note OBSERVATIONS (subjective style). One re-render max for fixes. Skip if trivial edit, user says skip, or render_preview errors.`;

export function buildSystemPrompt(
	context: AgentContext,
	mode?: AgentMode,
): string {
	const activeMode = mode ?? context.mode ?? "execute";

	const mediaSection =
		context.mediaAssets.length > 0
			? `Active media assets:\n${context.mediaAssets.map((m) => `- [id: ${m.id}] ${m.name} (${m.type}, ${m.duration}s)`).join("\n")}`
			: "No media assets loaded.";

	const parts = [
		"You are an AI assistant embedded in the NeuralCut video editor.",
		`Project: ${context.projectName ?? context.projectId ?? "No project loaded"}`,
		`Active scene: ${context.activeSceneId ?? "No active scene"}`,
	];

	if (context.resolution || context.fps || context.duration !== null) {
		const meta = [
			context.resolution
				? `${context.resolution.width}x${context.resolution.height}${context.aspectRatio ? ` (${context.aspectRatio})` : ""}`
				: null,
			context.fps !== null ? `${Math.round(context.fps * 100) / 100}fps` : null,
			context.duration !== null ? `${context.duration}s` : null,
		]
			.filter(Boolean)
			.join(" | ");
		if (meta) parts.push(meta);
	}

	if (context.resolution) {
		const { width, height } = context.resolution;
		parts.push(
			`COORDINATE SYSTEM: origin (0,0) = canvas center. positionX/positionY are absolute pixel offsets from center: +X right, -X left, +Y down, -Y up. Visual range ≈ ±${Math.round(width / 2)} X / ±${Math.round(height / 2)} Y. New text defaults to (0,0).`,
		);
	}

	parts.push(`Playback position: ${context.playbackTimeMs}ms`);
	parts.push(mediaSection);

	if (context.mediaAssets.length > 0) {
		parts.push(
			'IMPORTANT: When calling tools that accept an "assetId" parameter, always use the internal "id" value (e.g., "v1"), NOT the filename or display name.',
		);
	}

	parts.push(
		"All tools return { success: true, ...fields } on success or { error: string } on error. After write operations, call list_timeline to see updated state. Keyframe times are relative to element start, NOT timeline start.",
		"BATCH TOOL CALLS: invoke ALL independent tool calls in a single response. Multiple splits → one split call. Multiple effects → parallel apply_effect calls.",
		"For visual/audio questions about media, use load_context. For precise word timing/subtitles, use transcribe_audio.",
		"If load_context loaded media with fileData, answer visual/audio questions from that — no extra extraction needed.",
		"Only claim edits performed by actual tool calls. Do not say you added/removed/updated text unless the tool call succeeded.",
		"When user asks for titles, hooks, labels, captions, subtitles, or visible text → call add_text. Do not add text proactively for unrelated edits.",
		"SKILLS: For complex edits (viral video, pitch, etc.), call list_skills → load_skill to get technique recipes. Adapt to actual footage.",
		"TEXT CONSTRAINTS (hard-stop, enforced at tool level): fontSize MUST be 6–15 inclusive (out of range → error, NO clamping). Titles max ~15, subtitles 6–9. Word count: vertical/short-form canvas max 3 words, horizontal max 5–6 words depending on text length. Keep all text short and punchy — split long text across multiple timed elements instead.",
		"EDITING QUESTION RULE (HARD): Any editing-related question to the user MUST use the ask_user tool — NEVER ask editing questions in normal assistant prose. This includes questions about style, timing, scope, missing assets, target selection, creative direction, ambiguity, rhythm, color, typography, effects, audio handling, or any other decision that materially affects the edit. If you need the user's input on an editing decision, call ask_user. No exceptions.",
	);

	if (activeMode === "plan") {
		parts.push(PLAN_MODE_INSTRUCTIONS);
	} else {
		parts.push(EXECUTE_MODE_INSTRUCTIONS);
	}

	return parts.join("\n");
}
