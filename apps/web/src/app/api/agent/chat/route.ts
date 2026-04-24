import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AgentContext, ToolDefinition, ToolSchema } from "@/agent/types";
import { buildSystemPrompt } from "@/agent/system-prompt";
import { createProvider } from "@/agent/providers";
import type { ProviderConfig } from "@/agent/providers";
import { toToolSchemas } from "@/agent/tools/registry";

// ---------------------------------------------------------------------------
// Provider-facing tool schemas (execution is client-side)
// echo_context is intentionally excluded — only user-facing tools are exposed.
// ---------------------------------------------------------------------------
const providerToolDefs: ToolDefinition[] = [
	{
		name: "list_project_assets",
		description:
			"Lists project media assets with stable ids, type, duration, and whether each asset is used in the active timeline.",
		parameters: [
			{ key: "filter", type: "string", required: false },
			{ key: "type", type: "string", required: false },
		],
		execute: async () => ({}), // stub — never called server-side
	},
	{
		name: "list_timeline",
		description:
			"Lists the active timeline as structured tracks and editable elements with trackId, elementId, type, assetId, name, start, and end times.",
		parameters: [],
		execute: async () => ({}), // stub — never called server-side
	},
	{
		name: "transcribe_video",
		description:
			"Transcribes the audio of a video or audio asset using Whisper. Returns structured transcript with segments and timestamps.",
		parameters: [
			{ key: "assetId", type: "string", required: false },
			{ key: "language", type: "string", required: false },
			{ key: "modelId", type: "string", required: false },
		],
		execute: async () => ({}), // stub — never called server-side
	},
];

// ---------------------------------------------------------------------------
// Zod validation schemas
// ---------------------------------------------------------------------------
const toolCallSchema = z.object({
	id: z.string(),
	name: z.string(),
	args: z.record(z.string(), z.unknown()),
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
					elements: z.array(
						z.object({
							elementId: z.string(),
							type: z.string(),
							assetId: z.string().optional(),
							name: z.string().optional(),
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
		return NextResponse.json(
			{ error: "Invalid input", details: result.error.flatten().fieldErrors },
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
	const toolSchemas: ToolSchema[] = toToolSchemas(providerToolDefs);
	const systemPrompt = buildSystemPrompt(context, providerToolDefs);

	// Delegate to provider adapter
	try {
		const adapter = createProvider(config);
		const response = await adapter.chat({
			messages,
			systemPrompt,
			tools: toolSchemas,
		});

		return NextResponse.json({
			content: response.content,
			...(response.toolCalls && { toolCalls: response.toolCalls }),
		});
	} catch (error) {
		console.error("[agent/chat] Provider error:", error);
		return NextResponse.json({ error: "LLM provider error" }, { status: 502 });
	}
}
