import type { ChatMessage, ToolCall, ToolSchema } from "@/agent/types";

/**
 * Provider-agnostic configuration — read from LLM_* env vars.
 * Never exposed to the client.
 */
export interface ProviderConfig {
	provider: string;
	apiKey: string;
	model: string;
	baseUrl?: string;
}

/**
 * Canonical response shape — every adapter returns this.
 * The route passes this straight through to the client.
 */
export interface ProviderResponse {
	content: string;
	toolCalls?: ToolCall[];
}

/**
 * Adapter interface — one implementation per provider family.
 *
 * The adapter owns message-format conversion, tool-schema conversion,
 * and the actual API call. Callers (the route) never touch the wire
 * format directly.
 */
export interface ProviderAdapter {
	chat(params: {
		messages: ChatMessage[];
		systemPrompt: string;
		tools: ToolSchema[];
	}): Promise<ProviderResponse>;
}
