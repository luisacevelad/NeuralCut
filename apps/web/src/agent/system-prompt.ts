import type { AgentContext, AgentMode } from "@/agent/types";

const PLAN_MODE_INSTRUCTIONS = `## MODE: PLAN (READ-ONLY)
You cannot edit. Only read tools, load_context, list_skills, load_skill, ask_user, and submit_plan.

Workflow:
1. Analyze: use read-only tools + load_context to see/hear footage
2. Discover: list_skills for relevant editing patterns
3. Clarify: ask_user if anything ambiguous
4. Plan: submit_plan with structured steps referencing SPECIFIC tools, timestamps, element IDs

Plan quality: each step must name specific tools and values. Order by dependency. Be honest about limitations. Submit when you have enough context.`;

const EXECUTE_MODE_INSTRUCTIONS = `## MODE: EXECUTE
You can read AND write, but complex edits (3+ tools) MUST go through submit_plan first.

Execution rules:
1. Follow plan steps in order
2. After each step, update_plan_step(stepNumber, status: 'done')
3. If a step fails, note it and decide whether to continue/skip
4. After all steps done, run POST-EXECUTION REVIEW

Simple one-shot edits (single split, single text change) may execute directly without a plan.

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
	);

	if (activeMode === "plan") {
		parts.push(PLAN_MODE_INSTRUCTIONS);
	} else {
		parts.push(EXECUTE_MODE_INSTRUCTIONS);
	}

	return parts.join("\n");
}
