import {
	afterEach,
	beforeEach,
	describe,
	expect,
	jest,
	test,
} from "bun:test";
import { useChatStore } from "@/stores/chat-store";
import { useAgentStore } from "@/stores/agent-store";
import { toolRegistry } from "@/agent/tools/registry";
import type { AgentContext, ToolDefinition } from "@/agent/types";

// ---------------------------------------------------------------------------
// Mock the transitive WASM dependency chain before loading the orchestrator.
//
// The orchestrator imports tools that depend on @/agent/context, which imports
// @/core → opencut-wasm (WASM binary that can't load in test env).
//
// We mock @/agent/context to cut the entire WASM chain.
// We also mock @/lib/media/audio and @/services/transcription/service to prevent
// their side effects from loading.
// ---------------------------------------------------------------------------

jest.mock("@/agent/context", () => ({
	EditorContextAdapter: {
		getContext: () => ({
			projectId: null,
			activeSceneId: null,
			mediaAssets: [],
			playbackTimeMs: 0,
		}),
		resolveAssetFile: () => null,
		getAssetHasAudio: () => undefined,
	},
}));

jest.mock("@/lib/media/audio", () => ({
	decodeAudioToFloat32: jest.fn(),
}));

jest.mock("@/services/transcription/service", () => ({
	transcriptionService: {
		transcribe: jest.fn(),
	},
}));

// Dynamic import so mocks take effect before the module graph is resolved
const { run } = await import("@/agent/orchestrator");

// ---------------------------------------------------------------------------
// Test tools
// ---------------------------------------------------------------------------

const testTool: ToolDefinition = {
	name: "_test_tool",
	description: "A test tool with required params",
	parameters: [
		{ key: "input", type: "string", required: true },
		{ key: "count", type: "number", required: false },
		{ key: "flag", type: "boolean", required: true },
	],
	execute: async (args) => ({ echoed: args.input, flag: args.flag }),
};

const stringArrayTool: ToolDefinition = {
	name: "_test_string_array_tool",
	description: "A test tool with string array params",
	parameters: [{ key: "ids", type: "string[]", required: true }],
	execute: async (args) => ({ ids: args.ids }),
};

/** Tool that intentionally throws during execution — used to prove the
 *  orchestrator's resolveToolCalls catch block works at runtime. */
const throwingTool: ToolDefinition = {
	name: "_test_throwing_tool",
	description: "A tool that always throws",
	parameters: [
		{ key: "payload", type: "string", required: true },
	],
	execute: async () => {
		throw new Error("Transcription service unavailable");
	},
};

// Register once (registry is a singleton — re-registering overwrites)
toolRegistry.register("_test_tool", testTool);
toolRegistry.register("_test_string_array_tool", stringArrayTool);
toolRegistry.register("_test_throwing_tool", throwingTool);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function setMockFetch(
	fn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
) {
	globalThis.fetch = fn as typeof fetch;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("orchestrator", () => {
	beforeEach(() => {
		useChatStore.getState().clearMessages();
		useAgentStore.getState().reset();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	// -----------------------------------------------------------------------
	// Happy path — no tool calls
	// -----------------------------------------------------------------------

	test("appends assistant message when response has no tool calls", async () => {
		setMockFetch(() =>
			mockFetchResponse({ content: "Hello! How can I help?" }),
		);

		await run(
			[{ id: "1", role: "user", content: "Hi", timestamp: Date.now() }],
			MOCK_CONTEXT,
		);

		const chat = useChatStore.getState();
		const agent = useAgentStore.getState();

		expect(chat.messages).toHaveLength(1);
		expect(chat.messages[0].role).toBe("assistant");
		expect(chat.messages[0].content).toBe("Hello! How can I help?");
		expect(chat.loading).toBe(false);
		expect(chat.error).toBeNull();
		expect(agent.status).toBe("idle");
		expect(agent.context).toEqual(MOCK_CONTEXT);
	});

	// -----------------------------------------------------------------------
	// Tool call → resolve → loop → final answer
	// -----------------------------------------------------------------------

	test("resolves tool call and loops for final answer", async () => {
		let callCount = 0;
		setMockFetch(() => {
			callCount++;
			if (callCount === 1) {
				return mockFetchResponse({
					content: "Let me run the tool.",
					toolCalls: [
						{
							id: "tc_1",
							name: "_test_tool",
							args: { input: "hello", flag: true },
						},
					],
				});
			}
			return mockFetchResponse({
				content: "Here is the final answer.",
			});
		});

		await run(
			[{ id: "1", role: "user", content: "Go", timestamp: Date.now() }],
			MOCK_CONTEXT,
		);

		const chat = useChatStore.getState();
		const agent = useAgentStore.getState();

		// assistant (with toolCalls) + tool_result + assistant (final)
		expect(chat.messages).toHaveLength(3);
		expect(chat.messages[0].role).toBe("assistant");
		expect(chat.messages[0].toolCalls).toHaveLength(1);
		expect(chat.messages[1].role).toBe("tool_result");
		expect(chat.messages[1].content).toContain("echoed");
		expect(chat.messages[2].role).toBe("assistant");
		expect(chat.messages[2].content).toBe("Here is the final answer.");

		expect(agent.status).toBe("idle");
		expect(chat.loading).toBe(false);
	});

	// -----------------------------------------------------------------------
	// Max-iteration guard
	// -----------------------------------------------------------------------

	test("stops at MAX_ITERATIONS and appends limit message", async () => {
		// Every fetch response returns a tool call → loop hits the cap
		setMockFetch(() =>
			mockFetchResponse({
				content: "Thinking...",
				toolCalls: [
					{
						id: "tc_loop",
						name: "_test_tool",
						args: { input: "loop", flag: true },
					},
				],
			}),
		);

		await run(
			[{ id: "1", role: "user", content: "Loop", timestamp: Date.now() }],
			MOCK_CONTEXT,
		);

		const chat = useChatStore.getState();
		const agent = useAgentStore.getState();

		// 20 iterations × (1 assistant + 1 tool_result) + 1 cap message = 41
		expect(chat.messages).toHaveLength(41);

		// Last message is the cap message
		const lastMsg = chat.messages[chat.messages.length - 1];
		expect(lastMsg.role).toBe("assistant");
		expect(lastMsg.content).toContain("maximum number of reasoning steps");

		expect(agent.status).toBe("idle");
		expect(chat.loading).toBe(false);
	});

	// -----------------------------------------------------------------------
	// Arg validation — missing required arg
	// -----------------------------------------------------------------------

	test("returns error result when required arg is missing", async () => {
		let callCount = 0;
		setMockFetch(() => {
			callCount++;
			if (callCount === 1) {
				// Missing "input" (required) and "flag" (required)
				return mockFetchResponse({
					content: "Running tool",
					toolCalls: [
						{
							id: "tc_val",
							name: "_test_tool",
							args: { count: 5 },
						},
					],
				});
			}
			return mockFetchResponse({ content: "Done" });
		});

		await run(
			[{ id: "1", role: "user", content: "Test", timestamp: Date.now() }],
			MOCK_CONTEXT,
		);

		const chat = useChatStore.getState();

		// assistant (toolCalls) + tool_result (error) + assistant (final)
		expect(chat.messages).toHaveLength(3);

		const toolResult = chat.messages[1];
		expect(toolResult.role).toBe("tool_result");
		expect(toolResult.content).toContain("Missing required argument");
		expect(toolResult.content).toContain("input");
	});

	// -----------------------------------------------------------------------
	// Tool execution throws inside resolveToolCalls — runtime behavioral proof
	// -----------------------------------------------------------------------

	test("recovers when tool.execute() throws, continues loop to final answer", async () => {
		let callCount = 0;
		setMockFetch(() => {
			callCount++;
			if (callCount === 1) {
				return mockFetchResponse({
					content: "Running throwing tool.",
					toolCalls: [
						{
							id: "tc_throw",
							name: "_test_throwing_tool",
							args: { payload: "boom" },
						},
					],
				});
			}
			return mockFetchResponse({ content: "Recovered successfully." });
		});

		await run(
			[{ id: "1", role: "user", content: "Throw test", timestamp: Date.now() }],
			MOCK_CONTEXT,
		);

		const chat = useChatStore.getState();
		const agent = useAgentStore.getState();

		// assistant (with toolCalls) + tool_result (error) + assistant (final)
		expect(chat.messages).toHaveLength(3);

		// The tool_result should contain the thrown error message, NOT crash the orchestrator
		const toolResult = chat.messages[1];
		expect(toolResult.role).toBe("tool_result");
		expect(toolResult.content).toContain("Error in _test_throwing_tool");
		expect(toolResult.content).toContain("Transcription service unavailable");

		// Loop continues — final answer arrives
		const finalMsg = chat.messages[2];
		expect(finalMsg.role).toBe("assistant");
		expect(finalMsg.content).toBe("Recovered successfully.");

		// Orchestrator ends cleanly — no global error state
		expect(agent.status).toBe("idle");
		expect(chat.loading).toBe(false);
		expect(chat.error).toBeNull();
	});

	// -----------------------------------------------------------------------
	// Arg validation — wrong type
	// -----------------------------------------------------------------------

	test("returns error result when arg has wrong type", async () => {
		let callCount = 0;
		setMockFetch(() => {
			callCount++;
			if (callCount === 1) {
				// flag is boolean required, but we pass a string
				return mockFetchResponse({
					content: "Running tool",
					toolCalls: [
						{
							id: "tc_type",
							name: "_test_tool",
							args: { input: "hello", flag: "not-a-bool" },
						},
					],
				});
			}
			return mockFetchResponse({ content: "Done" });
		});

		await run(
			[{ id: "1", role: "user", content: "Test", timestamp: Date.now() }],
			MOCK_CONTEXT,
		);

		const chat = useChatStore.getState();
		const toolResult = chat.messages[1];
		expect(toolResult.role).toBe("tool_result");
		expect(toolResult.content).toContain("flag");
		expect(toolResult.content).toContain("must be a boolean");
	});

	test("validates string array arguments", async () => {
		let callCount = 0;
		setMockFetch(() => {
			callCount++;
			if (callCount === 1) {
				return mockFetchResponse({
					content: "Running tool",
					toolCalls: [
						{
							id: "tc_string_array",
							name: "_test_string_array_tool",
							args: { ids: ["a", 2] },
						},
					],
				});
			}
			return mockFetchResponse({ content: "Done" });
		});

		await run(
			[{ id: "1", role: "user", content: "Test", timestamp: Date.now() }],
			MOCK_CONTEXT,
		);

		const toolResult = useChatStore.getState().messages[1];
		expect(toolResult.role).toBe("tool_result");
		expect(toolResult.content).toContain("ids");
		expect(toolResult.content).toContain("must be an array of strings");
	});

	// -----------------------------------------------------------------------
	// Error paths
	// -----------------------------------------------------------------------

	test("sets error state on API failure", async () => {
		setMockFetch(() => mockFetchResponse({ error: "fail" }, 500));

		await run(
			[{ id: "1", role: "user", content: "Hi", timestamp: Date.now() }],
			MOCK_CONTEXT,
		);

		const chat = useChatStore.getState();
		const agent = useAgentStore.getState();

		expect(chat.error).toBeTruthy();
		expect(chat.loading).toBe(false);
		expect(agent.status).toBe("error");
		expect(chat.messages).toHaveLength(0);
	});

	test("sets error state on network failure", async () => {
		setMockFetch(() => Promise.reject(new Error("Network error")));

		await run(
			[{ id: "1", role: "user", content: "Hi", timestamp: Date.now() }],
			MOCK_CONTEXT,
		);

		const chat = useChatStore.getState();
		expect(chat.error).toBe("Network error");
		expect(chat.loading).toBe(false);
		expect(useAgentStore.getState().status).toBe("error");
	});

	// -----------------------------------------------------------------------
	// Context storage
	// -----------------------------------------------------------------------

	test("stores context in agentStore", async () => {
		setMockFetch(() => mockFetchResponse({ content: "ok" }));

		const context: AgentContext = {
			projectId: "special-proj",
			activeSceneId: "scene-X",
			mediaAssets: [
				{ id: "m1", name: "a.mp4", type: "video", duration: 10 },
			],
			playbackTimeMs: 1234,
		};

		await run([], context);

		const { context: stored } = useAgentStore.getState();
		expect(stored.projectId).toBe("special-proj");
		expect(stored.mediaAssets).toHaveLength(1);
	});
});
