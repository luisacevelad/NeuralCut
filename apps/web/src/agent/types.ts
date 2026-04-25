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
	thoughtSignature?: string;
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
	timelineTracks?: AgentTimelineTrack[];
	playbackTimeMs: number;
}

export type AgentTimelineTrack = {
	trackId: string;
	type: "main" | "overlay" | "audio" | "text" | "effect";
	/** Timeline row position, top-to-bottom. 0 is the top visible row. */
	position: number;
	/** Visual stacking layer. Higher numbers render above lower numbers. Audio is null. */
	visualLayer: number | null;
	isVisualLayer: boolean;
	stacking: "top" | "above_main" | "main" | "audio";
	elements: Array<{
		elementId: string;
		type: string;
		assetId?: string;
		name?: string;
		content?: string;
		/** Timeline start in seconds. */
		start: number;
		/** Timeline end in seconds. */
		end: number;
	}>;
};

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
