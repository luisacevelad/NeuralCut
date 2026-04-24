import type {
	AgentContext,
	ChatMessage,
	ToolCall,
	ToolDefinition,
	ToolResult,
} from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import "@/agent/tools/list-project-assets.tool";
import "@/agent/tools/transcribe-video.tool";
import { useChatStore } from "@/stores/chat-store";
import { useAgentStore } from "@/stores/agent-store";

/** Hard cap on multi-turn iterations (user-specified). */
const MAX_ITERATIONS = 8;

interface APIResponse {
	content: string;
	toolCalls?: ToolCall[];
}

/**
 * Client-side orchestrator — multi-turn loop (v2).
 *
 * 1. Sets agent status → sending
 * 2. Loop (max MAX_ITERATIONS):
 *    a. POST current message history to /api/agent/chat
 *    b. If toolCalls → validate args, resolve via registry, append results → loop
 *    c. If no toolCalls → append final assistant message → break
 * 3. On max-iteration cap → append limit message, idle
 * 4. Error → chatStore.error + error status
 */
export async function run(
	messages: ChatMessage[],
	context: AgentContext,
): Promise<void> {
	const agentStore = useAgentStore.getState();
	const chatStore = useChatStore.getState();

	agentStore.setContext(context);
	agentStore.setStatus("sending");

	// Working copy of messages that grows with each turn
	const workingMessages = [...messages];

	try {
		let iterations = 0;
		let hitCap = false;

		while (iterations < MAX_ITERATIONS) {
			iterations++;

			const response = await fetch("/api/agent/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ messages: workingMessages, context }),
			});

			if (!response.ok) {
				throw new Error(`API error: ${response.status}`);
			}

			const data: APIResponse = await response.json();

			// No tool calls → final answer, done
			if (!data.toolCalls || data.toolCalls.length === 0) {
				chatStore.addMessage({
					role: "assistant",
					content: data.content,
				});
				break;
			}

			// Tool calls present → validate, resolve, append, continue
			agentStore.setStatus("processing");

			// Append assistant message (with toolCalls) to chat + working history
			chatStore.addMessage({
				role: "assistant",
				content: data.content,
				toolCalls: data.toolCalls,
			});
			workingMessages.push({
				id: "",
				role: "assistant",
				content: data.content,
				toolCalls: data.toolCalls,
				timestamp: Date.now(),
			});

			// Resolve each tool call (validates args before execution)
			const toolResults = await resolveToolCalls(data.toolCalls, context);

			// Append tool results to chat + working history
			for (const tr of toolResults) {
				const content = tr.error
					? `Error in ${tr.name}: ${tr.error}`
					: JSON.stringify(tr.result);

				chatStore.addMessage({
					role: "tool_result",
					content,
					toolCallId: tr.toolCallId,
				});
				workingMessages.push({
					id: "",
					role: "tool_result",
					content,
					toolCallId: tr.toolCallId,
					timestamp: Date.now(),
				});
			}

			// If this was the last allowed iteration, mark cap hit
			if (iterations >= MAX_ITERATIONS) {
				hitCap = true;
			}
		}

		if (hitCap) {
			chatStore.addMessage({
				role: "assistant",
				content:
					"I've reached the maximum number of reasoning steps. Please continue the conversation for further assistance.",
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

// ---------------------------------------------------------------------------
// Arg validation
// ---------------------------------------------------------------------------

/**
 * Validates tool arguments against the tool's parameter schema.
 * Returns an error string on failure, or null if args are valid.
 */
function validateToolArgs(
	toolDef: ToolDefinition,
	args: Record<string, unknown>,
): string | null {
	for (const param of toolDef.parameters) {
		if (!param.required) continue;

		const value = args[param.key];

		if (value === undefined || value === null) {
			return `Missing required argument: ${param.key}`;
		}

		const actualType = typeof value;
		if (param.type === "string" && actualType !== "string") {
			return `Argument "${param.key}" must be a string, got ${actualType}`;
		}
		if (param.type === "number" && actualType !== "number") {
			return `Argument "${param.key}" must be a number, got ${actualType}`;
		}
		if (param.type === "boolean" && actualType !== "boolean") {
			return `Argument "${param.key}" must be a boolean, got ${actualType}`;
		}
	}

	return null;
}

// ---------------------------------------------------------------------------
// Tool resolution
// ---------------------------------------------------------------------------

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

			// Validate args BEFORE execution
			const validationError = validateToolArgs(tool, tc.args);
			if (validationError) {
				results.push({
					toolCallId: tc.id,
					name: tc.name,
					result: null,
					error: validationError,
				});
				continue;
			}

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
