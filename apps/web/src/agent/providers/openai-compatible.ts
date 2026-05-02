import OpenAI from "openai";
import type {
	ChatMessage,
	ToolCall,
	ToolParameter,
	ToolSchema,
} from "@/agent/types";
import { buildProviderDescription } from "@/agent/tools/schemas";
import type {
	ProviderAdapter,
	ProviderConfig,
	ProviderResponse,
} from "./types";

// ---------------------------------------------------------------------------
// OpenAI wire-format types (private to this adapter)
// ---------------------------------------------------------------------------

interface OpenAIFunctionTool {
	type: "function";
	function: {
		name: string;
		description: string;
		parameters: {
			type: "object";
			properties: Record<
				string,
				{
					type: string;
					description?: string;
					enum?: string[];
					items?: { type: string; description?: string; enum?: string[] };
				}
			>;
			required?: string[];
		};
	};
}

// ---------------------------------------------------------------------------
// Internal conversion helpers
// ---------------------------------------------------------------------------

/**
 * Converts internal ChatMessages into OpenAI chat-completion message format.
 * Prepends the system prompt as the first message.
 */
function toOpenAIMessages(
	messages: ChatMessage[],
	systemPrompt: string,
): Array<Record<string, unknown>> {
	const result: Array<Record<string, unknown>> = [
		{ role: "system", content: systemPrompt },
	];

	for (const msg of messages) {
		if (msg.role === "user") {
			result.push({ role: "user", content: msg.content });
		} else if (msg.role === "assistant") {
			const entry: Record<string, unknown> = {
				role: "assistant",
				content: msg.content,
			};
			if (msg.toolCalls && msg.toolCalls.length > 0) {
				entry.tool_calls = msg.toolCalls.map((tc) => ({
					id: tc.id,
					type: "function",
					function: {
						name: tc.name,
						arguments: JSON.stringify(tc.args),
					},
				}));
			}
			result.push(entry);
		} else if (msg.role === "tool_result") {
			result.push({
				role: "tool",
				tool_call_id: msg.toolCallId ?? "",
				content: msg.content,
			});
		}
	}

	return result;
}

/**
 * Converts provider-agnostic ToolDefinitions into OpenAI
 * function-calling tool format.
 */
function toOpenAIFunctions(tools: ToolSchema[]): OpenAIFunctionTool[] {
	return tools.map((tool) => ({
		type: "function" as const,
		function: {
			name: tool.name,
			description: buildProviderDescription(tool),
			parameters: {
				type: "object" as const,
				properties: Object.fromEntries(
					tool.parameters.map((p) => [p.key, toOpenAIParameterSchema(p)]),
				),
				...(tool.parameters.some((p) => p.required) && {
					required: tool.parameters.filter((p) => p.required).map((p) => p.key),
				}),
			},
		},
	}));
}

type OpenAISchema = {
	type: string;
	description?: string;
	enum?: string[];
	items?: OpenAISchema;
	properties?: Record<string, OpenAISchema>;
	required?: string[];
};

function toOpenAIParameterSchema(param: ToolParameter): OpenAISchema {
	const { type } = param;
	const common = {
		...(param.description && { description: param.description }),
		...(param.enum && { enum: param.enum }),
	};
	if (type === "number") return { type: "number", ...common };
	if (type === "boolean") return { type: "boolean", ...common };
	if (type === "number[]") return { type: "array", items: { type: "number" } };
	if (type === "string[]") return { type: "array", items: { type: "string" } };
	if (type === "object") {
		const props: Record<string, OpenAISchema> = {};
		if (param.properties) {
			for (const p of param.properties) {
				props[p.key] = toOpenAIParameterSchema(p);
			}
		}
		const required = param.properties?.filter((p) => p.required).map((p) => p.key);
		return {
			type: "object",
			properties: props,
			...(required && required.length > 0 && { required }),
			...common,
		};
	}
	if (type === "array" && param.items) {
		return {
			type: "array",
			...common,
			items: toOpenAIParameterSchema(param.items),
		};
	}
	return { type: "string", ...common };
}

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------

/**
 * OpenAI-compatible adapter.
 *
 * Covers OpenAI, Groq, local Ollama, or any baseUrl-driven provider
 * that speaks the OpenAI chat-completions API.
 */
export class OpenAICompatibleAdapter implements ProviderAdapter {
	private client: OpenAI;
	private model: string;

	constructor(config: ProviderConfig) {
		this.client = new OpenAI({
			apiKey: config.apiKey,
			...(config.baseUrl && { baseURL: config.baseUrl }),
		});
		this.model = config.model;
	}

	async chat(params: {
		messages: ChatMessage[];
		systemPrompt: string;
		tools: ToolSchema[];
	}): Promise<ProviderResponse> {
		const openaiMessages = toOpenAIMessages(
			params.messages,
			params.systemPrompt,
		);
		const openaiTools = toOpenAIFunctions(params.tools);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const requestParams: any = {
			model: this.model,
			messages: openaiMessages,
		};

		if (openaiTools.length > 0) {
			requestParams.tools = openaiTools;
		}

		const response = await this.client.chat.completions.create(requestParams);

		const choice = response.choices[0];
		if (!choice) {
			throw new Error("Empty response from AI provider");
		}

		const content = choice.message.content ?? "";
		let toolCalls: ToolCall[] | undefined;

		if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
			toolCalls = choice.message.tool_calls
				.filter(
					(tc): tc is Extract<typeof tc, { type: "function" }> =>
						tc.type === "function",
				)
				.map((tc) => ({
					id: tc.id,
					name: tc.function.name,
					args: JSON.parse(tc.function.arguments),
				}));
		}

		return {
			content,
			...(toolCalls && { toolCalls }),
			...(response.usage && {
				usage: {
					promptTokens: response.usage.prompt_tokens,
					completionTokens: response.usage.completion_tokens,
					totalTokens: response.usage.total_tokens,
					cachedTokens:
						(response.usage as Record<string, unknown>)
							.prompt_tokens_details &&
						Array.isArray(
							(response.usage as Record<string, unknown>).prompt_tokens_details,
						)
							? (
									(
										(response.usage as Record<string, unknown>)
											.prompt_tokens_details as Array<Record<string, unknown>>
									).find((d) => d.cached_tokens) as
										| { cached_tokens?: number }
										| undefined
								)?.cached_tokens ?? 0
							: 0,
				},
			}),
		};
	}
}
