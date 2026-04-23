export type ExecutionState =
	| "idle"
	| "sending"
	| "processing"
	| "responding"
	| "error";

export interface ChatMessage {
	id: string;
	role: "user" | "assistant" | "tool_result";
	content: string;
	toolCalls?: ToolCall[];
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
