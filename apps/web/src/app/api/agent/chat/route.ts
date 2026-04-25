import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AgentContext, ToolSchema } from "@/agent/types";
import { buildSystemPrompt } from "@/agent/system-prompt";
import { createProvider } from "@/agent/providers";
import type { ProviderConfig } from "@/agent/providers";

// ---------------------------------------------------------------------------
// Provider-facing tool schemas. Execution is client-side.
// echo_context is intentionally excluded; only user-facing tools are exposed.
// ---------------------------------------------------------------------------
const providerToolSchemas: ToolSchema[] = [
	{
		name: "load_context",
		description:
			"Loads the actual Gemini multimodal context for a project asset or timeline element. Use this before answering questions about visible objects, colors, scenes, speech, silence, or timestamps in media. Use targetType='asset' with assetId/id for media, or targetType='timeline_element' with trackId and elementId/id for captions, text, or timeline media elements.",
		parameters: [
			{ key: "targetType", type: "string", required: true },
			{ key: "id", type: "string", required: false },
			{ key: "assetId", type: "string", required: false },
			{ key: "trackId", type: "string", required: false },
			{ key: "elementId", type: "string", required: false },
		],
	},
	{
		name: "list_project_assets",
		description:
			"Lists project media assets with stable ids, type, duration, and whether each asset is used in the active timeline.",
		parameters: [
			{ key: "filter", type: "string", required: false },
			{ key: "type", type: "string", required: false },
		],
	},
	{
		name: "list_timeline",
		description:
			"Lists the active timeline as structured tracks and editable elements with layer metadata. Element start/end values are in seconds. Tracks include position (top-to-bottom timeline row), visualLayer (higher renders above lower, null for audio), isVisualLayer, and stacking. Use this to understand which clips visually cover others and to discover ids before load_context.",
		parameters: [],
	},
	{
		name: "split",
		description:
			"Splits timeline elements at one or more requested timeline times in seconds without deleting, trimming, or moving content. Use one time for a single cut, or multiple times to isolate ranges before separate edit/delete operations.",
		parameters: [{ key: "times", type: "number[]", required: true }],
	},
	{
		name: "delete_timeline_elements",
		description:
			"Deletes one or more timeline elements by elementId. Use list_timeline first to discover exact elementIds. To delete a time range, split at the range boundaries first, then delete the isolated elementIds.",
		parameters: [{ key: "elementIds", type: "string[]", required: true }],
	},
	{
		name: "move_timeline_elements",
		description:
			"Moves one or more existing timeline elements to a new timeline start time in seconds. For multiple elements, the earliest selected element is moved to start and the others preserve their relative offsets. Optionally pass targetTrackId to move them to another compatible track.",
		parameters: [
			{ key: "elementIds", type: "string[]", required: true },
			{ key: "start", type: "number", required: true },
			{ key: "targetTrackId", type: "string", required: false },
		],
	},
	{
		name: "add_media_to_timeline",
		description:
			"Adds an existing project media asset to the active timeline. Use list_project_assets first to discover assetId. startTime and optional duration are in timeline seconds. trackType must be main, overlay, or audio.",
		parameters: [
			{ key: "assetId", type: "string", required: true },
			{ key: "startTime", type: "number", required: true },
			{ key: "trackType", type: "string", required: true },
			{ key: "duration", type: "number", required: false },
		],
	},
	{
		name: "update_timeline_element_timing",
		description:
			"Updates an existing timeline element's timing. Use list_timeline first to discover elementId. start, end, and duration are timeline seconds; pass at least one of start, end, or duration.",
		parameters: [
			{ key: "elementId", type: "string", required: true },
			{ key: "start", type: "number", required: false },
			{ key: "end", type: "number", required: false },
			{ key: "duration", type: "number", required: false },
		],
	},
];

// ---------------------------------------------------------------------------
// Zod validation schemas
// ---------------------------------------------------------------------------
const toolCallSchema = z.object({
	id: z.string(),
	name: z.string(),
	args: z.record(z.string(), z.unknown()),
	thoughtSignature: z.string().optional(),
});

const chatRequestSchema = z.object({
	messages: z.array(
		z.object({
			id: z.string(),
			role: z.enum(["user", "assistant", "tool_result"]),
			content: z.string(),
			toolCalls: z.array(toolCallSchema).optional(),
			toolCallId: z.string().optional(),
			timestamp: z.number(),
		}),
	),
	context: z.object({
		projectId: z.string().nullable(),
		activeSceneId: z.string().nullable(),
		mediaAssets: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				type: z.string(),
				duration: z.number(),
				usedInTimeline: z.boolean().optional(),
			}),
		),
		timelineTracks: z
			.array(
				z.object({
					trackId: z.string(),
					type: z.enum(["main", "overlay", "audio", "text", "effect"]),
					position: z.number(),
					visualLayer: z.number().nullable(),
					isVisualLayer: z.boolean(),
					stacking: z.enum(["top", "above_main", "main", "audio"]),
					elements: z.array(
						z.object({
							elementId: z.string(),
							type: z.string(),
							assetId: z.string().optional(),
							name: z.string().optional(),
							content: z.string().optional(),
							start: z.number(),
							end: z.number(),
						}),
					),
				}),
			)
			.optional(),
		playbackTimeMs: z.number(),
	}) satisfies z.ZodType<AgentContext>,
});

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
	const body = await request.json();
	const result = chatRequestSchema.safeParse(body);

	if (!result.success) {
		const fieldErrors = result.error.flatten().fieldErrors;
		if (process.env.NODE_ENV === "development") {
			console.error(
				"[agent/chat] Validation failed:",
				JSON.stringify({ fieldErrors }, null, 2),
			);
		}
		return NextResponse.json(
			{ error: "Invalid input", details: fieldErrors },
			{ status: 400 },
		);
	}

	const { messages, context } = result.data;

	// Resolve provider config from LLM_* env vars
	const provider = process.env.LLM_PROVIDER;
	const apiKey = process.env.LLM_API_KEY;
	const model = process.env.LLM_MODEL;
	const baseUrl = process.env.LLM_BASE_URL;

	if (!provider || !apiKey || !model) {
		return NextResponse.json(
			{
				error:
					"Server configuration error: missing LLM_PROVIDER, LLM_API_KEY, or LLM_MODEL",
			},
			{ status: 502 },
		);
	}

	const config: ProviderConfig = { provider, apiKey, model, baseUrl };

	// Build system prompt with tool guidance
	const systemPrompt = buildSystemPrompt(context, providerToolSchemas);

	// Delegate to provider adapter
	try {
		const adapter = createProvider(config);
		const response = await adapter.chat({
			messages,
			systemPrompt,
			tools: providerToolSchemas,
		});

		return NextResponse.json({
			content: response.content,
			...(response.toolCalls && { toolCalls: response.toolCalls }),
		});
	} catch (error) {
		const status = (error as { status?: number }).status;
		const message =
			error instanceof Error ? error.message : "Unknown provider error";
		const providerError = toProviderErrorResponse({ message, status });
		console.error("[agent/chat] Provider error:", error);
		return NextResponse.json(
			{
				error: providerError.error,
				...(status ? { providerStatus: status } : {}),
				...(process.env.NODE_ENV === "development" ? { detail: message } : {}),
			},
			{ status: providerError.status },
		);
	}
}

function toProviderErrorResponse({
	message,
	status,
}: {
	message: string;
	status?: number;
}): { error: string; status: number } {
	if (status === 429 && isBillingOrQuotaExhaustedMessage(message)) {
		return {
			status: 402,
			error:
				"Gemini credits are depleted. Add credits in AI Studio or switch LLM_PROVIDER/LLM_MODEL in .env.local.",
		};
	}

	return { status: 502, error: "LLM provider error" };
}

function isBillingOrQuotaExhaustedMessage(message: string): boolean {
	return /prepayment credits are depleted|billing|quota.*(?:depleted|exhausted)/i.test(
		message,
	);
}
