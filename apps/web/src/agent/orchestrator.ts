import type {
	AgentContext,
	ChatMessage,
	ToolCall,
	ToolDefinition,
	ToolResult,
} from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import "@/agent/tools/load-context.tool";
import "@/agent/tools/list-project-assets.tool";
import "@/agent/tools/list-timeline.tool";
import "@/agent/tools/split.tool";
import "@/agent/tools/delete-timeline-elements.tool";
import { useChatStore } from "@/stores/chat-store";
import { useAgentStore } from "@/stores/agent-store";

const MAX_ITERATIONS = 20;

interface APIResponse {
	content: string;
	toolCalls?: ToolCall[];
}

export async function run(
	messages: ChatMessage[],
	context: AgentContext,
): Promise<void> {
	const agentStore = useAgentStore.getState();
	const chatStore = useChatStore.getState();

	agentStore.setContext(context);
	agentStore.setStatus("sending");

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
				let detail = "";
				try {
					const errBody = await response.json();
					detail = errBody?.error ?? JSON.stringify(errBody);
				} catch {
					detail = response.statusText;
				}
				throw new Error(`API error ${response.status}: ${detail}`);
			}

			const data: APIResponse = await response.json();

			if (!data.toolCalls || data.toolCalls.length === 0) {
				if (!data.content || data.content.trim().length === 0) {
					throw new Error("Empty response from provider");
				}
				chatStore.addMessage({
					role: "assistant",
					content: data.content,
				});
				break;
			}

			agentStore.setStatus("processing");

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

			const toolResults = await resolveToolCalls(data.toolCalls, context);

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
		console.error("[orchestrator] Error:", message);
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
		if (
			param.type === "number[]" &&
			(!Array.isArray(value) ||
				!value.every((item) => typeof item === "number"))
		) {
			return `Argument "${param.key}" must be an array of numbers`;
		}
		if (
			param.type === "string[]" &&
			(!Array.isArray(value) ||
				!value.every((item) => typeof item === "string"))
		) {
			return `Argument "${param.key}" must be an array of strings`;
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
