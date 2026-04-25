import {
	GoogleGenerativeAI,
	type Content,
	type FunctionDeclaration,
	type FunctionDeclarationSchema,
	type GenerateContentResult,
	type Schema,
	SchemaType,
} from "@google/generative-ai";
import type { ChatMessage, ToolCall, ToolSchema } from "@/agent/types";
import type {
	ProviderAdapter,
	ProviderConfig,
	ProviderResponse,
} from "./types";

// ---------------------------------------------------------------------------
// Internal conversion helpers
// ---------------------------------------------------------------------------

const GEMINI_MAX_ATTEMPTS = 5;
const GEMINI_RETRY_BASE_DELAY_MS = process.env.NODE_ENV === "test" ? 0 : 1000;
const GEMINI_RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function getProviderStatus(error: unknown): number | null {
	const status = (error as { status?: unknown })?.status;
	if (typeof status === "number") return status;

	const message = error instanceof Error ? error.message : String(error);
	const match = message.match(/\[(\d{3})\s/);
	return match ? Number(match[1]) : null;
}

function isRetryableProviderError(error: unknown): boolean {
	const status = getProviderStatus(error);
	if (status === 429 && isBillingOrQuotaExhaustedError(error)) {
		return false;
	}

	return status !== null && GEMINI_RETRYABLE_STATUSES.has(status);
}

function isBillingOrQuotaExhaustedError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /prepayment credits are depleted|billing|quota.*(?:depleted|exhausted)/i.test(
		message,
	);
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withGeminiRetry<T>(operation: () => Promise<T>): Promise<T> {
	let lastError: unknown;

	for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt++) {
		try {
			return await operation();
		} catch (error) {
			lastError = error;

			if (attempt === GEMINI_MAX_ATTEMPTS || !isRetryableProviderError(error)) {
				throw error;
			}

			const backoffMs = GEMINI_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
			const jitterMs =
				GEMINI_RETRY_BASE_DELAY_MS === 0 ? 0 : Math.random() * 250;
			await wait(backoffMs + jitterMs);
		}
	}

	throw lastError;
}

/**
 * Converts internal ChatMessages into Gemini Content[].
 *
 * - `user`       → role "user", text part
 * - `assistant`  → role "model", text part + functionCall parts from toolCalls
 * - `tool_result`→ role "function", functionResponse part
 * - `system`     → skipped (handled separately via systemInstruction)
 */
export function toGeminiContents(messages: ChatMessage[]): Content[] {
	const contents: Content[] = [];

	for (const msg of messages) {
		if (msg.role === "system") {
			continue;
		}

		if (msg.role === "user") {
			contents.push({
				role: "user",
				parts: [{ text: msg.content }],
			});
		} else if (msg.role === "assistant") {
			const parts: Content["parts"] = [];

			if (msg.content) {
				parts.push({ text: msg.content });
			}

			if (msg.toolCalls && msg.toolCalls.length > 0) {
				for (const tc of msg.toolCalls) {
					parts.push({
						functionCall: { name: tc.name, args: tc.args },
						...(tc.thoughtSignature
							? { thoughtSignature: tc.thoughtSignature }
							: {}),
					});
				}
			}

			contents.push({ role: "model", parts });
		} else if (msg.role === "tool_result") {
			// Gemini uses the function name to correlate responses, not IDs.
			// We parse the content as JSON for the response object; fall back
			// to wrapping it if it's not valid JSON.
			let responseData: object;
			try {
				responseData = JSON.parse(msg.content) as object;
			} catch {
				responseData = { result: msg.content };
			}

			// Derive the function name from the toolCallId → find the matching
			// tool name in prior messages. If not found, use a placeholder.
			const toolName = findToolNameForResult(messages, msg.toolCallId);

			contents.push({
				role: "function",
				parts: [
					{
						functionResponse: {
							name: toolName,
							response: responseData,
						},
					},
				],
			});

			const loadedMediaContext = getLoadedMediaContext(responseData);
			if (loadedMediaContext) {
				contents.push({
					role: "user",
					parts: [
						{
							text: `Loaded media context from ${toolName}: ${loadedMediaContext.assetName}. The attached fileData is the actual media file, not just metadata. Use Gemini's multimodal video/audio/visual understanding to answer questions about visible objects, colors, scenes, speech, silence, and timestamps. Do not claim you only have metadata for this loaded file.`,
						},
						{
							fileData: {
								fileUri: loadedMediaContext.fileUri,
								mimeType: loadedMediaContext.mimeType,
							},
						},
					],
				});
			}
		}
	}

	return contents;
}

function getLoadedMediaContext(responseData: object): {
	assetName: string;
	fileUri: string;
	mimeType: string;
} | null {
	const context = (responseData as { context?: unknown }).context;
	if (!context || typeof context !== "object") {
		return null;
	}

	const maybeMediaContext = context as {
		kind?: unknown;
		assetName?: unknown;
		fileUri?: unknown;
		mimeType?: unknown;
	};

	if (
		maybeMediaContext.kind !== "media" ||
		typeof maybeMediaContext.assetName !== "string" ||
		typeof maybeMediaContext.fileUri !== "string" ||
		typeof maybeMediaContext.mimeType !== "string"
	) {
		return null;
	}

	return {
		assetName: maybeMediaContext.assetName,
		fileUri: maybeMediaContext.fileUri,
		mimeType: maybeMediaContext.mimeType,
	};
}

/**
 * Walks backward through messages to find the function name associated with
 * a toolCallId. This is needed because Gemini's functionResponse uses names,
 * not IDs.
 */
function findToolNameForResult(
	messages: ChatMessage[],
	toolCallId?: string,
): string {
	if (!toolCallId) return "unknown";

	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg.role === "assistant" && msg.toolCalls) {
			const match = msg.toolCalls.find((tc) => tc.id === toolCallId);
			if (match) return match.name;
		}
	}

	return "unknown";
}

/**
 * Converts internal ToolSchema[] into Gemini FunctionDeclaration[].
 *
 * Maps internal type strings ("string", "number", etc.) to Gemini SchemaType
 * enum values. Returns an empty array when no tools are provided.
 */
export function toGeminiTools(tools: ToolSchema[]): FunctionDeclaration[] {
	if (tools.length === 0) return [];

	return tools.map((tool) => {
		const properties: FunctionDeclarationSchema["properties"] = {};

		for (const param of tool.parameters) {
			properties[param.key] = toGeminiParameterSchema(param.type);
		}

		const requiredParams = tool.parameters
			.filter((p) => p.required)
			.map((p) => p.key);

		return {
			name: tool.name,
			description: tool.description,
			parameters: {
				type: SchemaType.OBJECT,
				properties,
				...(requiredParams.length > 0 && { required: requiredParams }),
			},
		};
	});
}

function toGeminiParameterSchema(type: string): Schema {
	if (type === "number") return { type: SchemaType.NUMBER };
	if (type === "boolean") return { type: SchemaType.BOOLEAN };
	if (type === "object") return { type: SchemaType.OBJECT, properties: {} };
	if (type === "number[]") {
		return { type: SchemaType.ARRAY, items: { type: SchemaType.NUMBER } };
	}

	return { type: SchemaType.STRING };
}

/**
 * Converts a Gemini GenerateContentResult into the provider-agnostic
 * ProviderResponse shape.
 *
 * - Text parts are concatenated into `content`.
 * - FunctionCall parts are mapped to `toolCalls[]` with synthesized UUIDs.
 * - Throws if no candidates are present.
 */
export function fromGeminiResponse(
	response: GenerateContentResult,
): ProviderResponse {
	const candidates = response.response.candidates;
	if (!candidates || candidates.length === 0) {
		throw new Error("Empty response from Gemini provider");
	}

	const parts = candidates[0].content?.parts ?? [];
	const textParts: string[] = [];
	const toolCalls: ToolCall[] = [];

	for (const part of parts) {
		if ("text" in part && part.text !== undefined) {
			textParts.push(part.text);
		}
		if ("functionCall" in part && part.functionCall) {
			const thoughtSignature = (part as { thoughtSignature?: unknown })
				.thoughtSignature;
			toolCalls.push({
				id: crypto.randomUUID(),
				name: part.functionCall.name,
				args: (part.functionCall.args as Record<string, unknown>) ?? {},
				...(typeof thoughtSignature === "string" ? { thoughtSignature } : {}),
			});
		}
	}

	const content = textParts.join("");
	const result: ProviderResponse = { content };

	if (toolCalls.length > 0) {
		result.toolCalls = toolCalls;
	}

	return result;
}

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------

/**
 * Gemini adapter using @google/generative-ai SDK.
 *
 * Uses the stateless `generateContent()` API — full history is sent with each
 * call, matching the existing route contract. System prompts are mapped to
 * Gemini's `systemInstruction` field, not as user messages.
 */
export class GeminiAdapter implements ProviderAdapter {
	private model;

	constructor(config: ProviderConfig) {
		const genAI = new GoogleGenerativeAI(config.apiKey);
		this.model = genAI.getGenerativeModel({ model: config.model });
		// config.baseUrl is intentionally ignored for the Gemini provider.
	}

	async chat(params: {
		messages: ChatMessage[];
		systemPrompt: string;
		tools: ToolSchema[];
	}): Promise<ProviderResponse> {
		const contents = toGeminiContents(params.messages);
		const functionDeclarations = toGeminiTools(params.tools);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const request: any = { contents };

		if (params.systemPrompt) {
			request.systemInstruction = params.systemPrompt;
		}

		if (functionDeclarations.length > 0) {
			request.tools = [{ functionDeclarations }];
		}

		const result = await withGeminiRetry(() =>
			this.model.generateContent(request),
		);
		return fromGeminiResponse(result);
	}
}
