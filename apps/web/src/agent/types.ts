export type ExecutionState =
	| "idle"
	| "sending"
	| "processing"
	| "responding"
	| "error";

export interface ChatMessage {
	id: string;
	role: "system" | "user" | "assistant" | "tool_result";
	content: string;
	toolCalls?: ToolCall[];
	/** Associates a tool_result message with the ToolCall it answers. */
	toolCallId?: string;
	timestamp: number;
}

export interface ToolCall {
	id: string;
	name: string;
	args: Record<string, unknown>;
}

export interface ToolResult {
	toolCallId: string;
	name: string;
	result: unknown;
	error?: string;
}

export interface AgentContext {
	projectId: string | null;
	activeSceneId: string | null;
	mediaAssets: Array<{
		id: string;
		name: string;
		type: string;
		duration: number;
		usedInTimeline?: boolean;
	}>;
	playbackTimeMs: number;
}

export interface ToolDefinition {
	name: string;
	description: string;
	parameters: Array<{ key: string; type: string; required: boolean }>;
	execute: (
		args: Record<string, unknown>,
		context: AgentContext,
	) => Promise<unknown>;
}

/**
 * Provider-agnostic tool schema — a pure data DTO without `execute`.
 * Adapters convert this to their wire format; the route never passes
 * executable definitions across the provider boundary.
 */
export interface ToolSchema {
	name: string;
	description: string;
	parameters: Array<{ key: string; type: string; required: boolean }>;
}
