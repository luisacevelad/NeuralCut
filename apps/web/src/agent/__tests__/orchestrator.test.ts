import {
	afterEach,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import { run } from "@/agent/orchestrator";
import { useChatStore } from "@/stores/chat-store";
import { useAgentStore } from "@/stores/agent-store";
import type { AgentContext, ChatMessage } from "@/agent/types";

const MOCK_CONTEXT: AgentContext = {
	projectId: "proj-1",
	activeSceneId: "scene-A",
	mediaAssets: [],
	playbackTimeMs: 0,
};

const originalFetch = globalThis.fetch;

function mockFetchResponse(data: unknown, status = 200) {
	return Promise.resolve(
		new Response(JSON.stringify(data), {
			status,
			headers: { "Content-Type": "application/json" },
		}),
	);
}

function setMockFetch(fn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
	globalThis.fetch = fn as typeof fetch;
}

describe("orchestrator", () => {
	beforeEach(() => {
		useChatStore.getState().clearMessages();
		useAgentStore.getState().reset();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	test("happy path — no tool calls", async () => {
		setMockFetch(() =>
			mockFetchResponse({
				content: "Hello! How can I help?",
			}));

		const messages: ChatMessage[] = [
			{ id: "1", role: "user", content: "Hi", timestamp: Date.now() },
		];

		await run(messages, MOCK_CONTEXT);

		const chatState = useChatStore.getState();
		const agentState = useAgentStore.getState();

		// Assistant message appended
		expect(chatState.messages).toHaveLength(1);
		expect(chatState.messages[0].role).toBe("assistant");
		expect(chatState.messages[0].content).toBe("Hello! How can I help?");

		// Loading cleared
		expect(chatState.loading).toBe(false);
		expect(chatState.error).toBeNull();

		// Agent state reset
		expect(agentState.status).toBe("idle");
		expect(agentState.activeTool).toBeNull();
		expect(agentState.context).toEqual(MOCK_CONTEXT);
	});

	test("tool call resolution — echo_context executes", async () => {
		setMockFetch(() =>
			mockFetchResponse({
				content: "Let me check your editor context.",
				toolCalls: [
					{ id: "tc_1", name: "echo_context", args: {} },
				],
			}));

		const messages: ChatMessage[] = [
			{ id: "1", role: "user", content: "Show me context", timestamp: Date.now() },
		];

		await run(messages, MOCK_CONTEXT);

		const chatState = useChatStore.getState();
		const agentState = useAgentStore.getState();

		// Assistant message + tool result
		expect(chatState.messages).toHaveLength(2);
		expect(chatState.messages[0].role).toBe("assistant");
		expect(chatState.messages[1].role).toBe("tool_result");

		// Tool result should contain echo_context output
		const toolResult = JSON.parse(chatState.messages[1].content);
		expect(toolResult.projectId).toBe("proj-1");

		// States cleaned up
		expect(chatState.loading).toBe(false);
		expect(agentState.status).toBe("idle");
		expect(agentState.context).toEqual(MOCK_CONTEXT);
	});

	test("error path — API failure sets error and loading cleared", async () => {
		setMockFetch(() =>
			mockFetchResponse({ error: "fail" }, 500));

		const messages: ChatMessage[] = [
			{ id: "1", role: "user", content: "Hi", timestamp: Date.now() },
		];

		await run(messages, MOCK_CONTEXT);

		const chatState = useChatStore.getState();
		const agentState = useAgentStore.getState();

		// Error set
		expect(chatState.error).toBeTruthy();
		expect(chatState.loading).toBe(false);

		// Agent in error state
		expect(agentState.status).toBe("error");

		// No assistant message added
		expect(chatState.messages).toHaveLength(0);
	});

	test("error path — network failure sets error", async () => {
		setMockFetch(() => Promise.reject(new Error("Network error")));

		const messages: ChatMessage[] = [
			{ id: "1", role: "user", content: "Hi", timestamp: Date.now() },
		];

		await run(messages, MOCK_CONTEXT);

		const chatState = useChatStore.getState();
		expect(chatState.error).toBe("Network error");
		expect(chatState.loading).toBe(false);
		expect(useAgentStore.getState().status).toBe("error");
	});

	test("context is stored in agentStore", async () => {
		setMockFetch(() =>
			mockFetchResponse({ content: "ok" }));

		const context: AgentContext = {
			projectId: "special-proj",
			activeSceneId: "scene-X",
			mediaAssets: [{ id: "m1", name: "a.mp4", type: "video", duration: 10 }],
			playbackTimeMs: 1234,
		};

		await run([], context);

		const { context: stored } = useAgentStore.getState();
		expect(stored.projectId).toBe("special-proj");
		expect(stored.mediaAssets).toHaveLength(1);
	});
});
