import type {
	AgentContext,
	ChatMessage,
	ToolCall,
	ToolResult,
} from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import "@/agent/tools/mock.tool";
import { useChatStore } from "@/stores/chat-store";
import { useAgentStore } from "@/stores/agent-store";

interface APIResponse {
	content: string;
	toolCalls?: ToolCall[];
}

/**
 * Client-side orchestrator — single-pass only (v1).
 *
 * 1. Sets agent status → sends
 * 2. POST to /api/agent/chat
 * 3. Resolves any tool calls via the registry
 * 4. Appends assistant message + tool results to chatStore
 * 5. Returns to idle (or error)
 */
export async function run(
	messages: ChatMessage[],
	context: AgentContext,
): Promise<void> {
	const agentStore = useAgentStore.getState();
	const chatStore = useChatStore.getState();

	agentStore.setContext(context);
	agentStore.setStatus("sending");

	try {
		const response = await fetch("/api/agent/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ messages, context }),
		});

		if (!response.ok) {
			throw new Error(`API error: ${response.status}`);
		}

		const data: APIResponse = await response.json();

		// Resolve tool calls if present
		let toolResults: ToolResult[] = [];
		if (data.toolCalls && data.toolCalls.length > 0) {
			agentStore.setStatus("processing");
			toolResults = await resolveToolCalls(data.toolCalls, context);
		}

		// Append assistant response
		chatStore.addMessage({
			role: "assistant",
			content: data.content,
			toolCalls: data.toolCalls,
		});

		// Append tool results as separate messages
		for (const tr of toolResults) {
			chatStore.addMessage({
				role: "tool_result",
				content: tr.error
					? `Error in ${tr.name}: ${tr.error}`
					: JSON.stringify(tr.result),
			});
		}

		agentStore.setStatus("idle");
		chatStore.setLoading(false);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown orchestrator error";
		chatStore.setError(message);
		agentStore.setStatus("error");
	}
}

async function resolveToolCalls(
	toolCalls: ToolCall[],
	context: AgentContext,
): Promise<ToolResult[]> {
	const agentStore = useAgentStore.getState();
	const results: ToolResult[] = [];

	for (const tc of toolCalls) {
		agentStore.setActiveTool(tc.name);

		try {
			const tool = toolRegistry.get(tc.name);
			const result = await tool.execute(tc.args, context);
			results.push({ toolCallId: tc.id, name: tc.name, result });
		} catch (error) {
			results.push({
				toolCallId: tc.id,
				name: tc.name,
				result: null,
				error: error instanceof Error ? error.message : "Tool execution failed",
			});
		}
	}

	agentStore.setActiveTool(null);
	return results;
}
