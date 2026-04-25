import { beforeEach, describe, expect, jest, test } from "bun:test";
import type { ProviderConfig } from "@/agent/providers/types";
import type { ToolDefinition } from "@/agent/types";

// ---------------------------------------------------------------------------
// Mock the openai SDK before any module that imports it is loaded
// ---------------------------------------------------------------------------

const mockCreate = jest.fn();

jest.mock("openai", () => ({
	default: class MockOpenAI {
		chat = {
			completions: {
				create: mockCreate,
			},
		};
		constructor(_opts: { apiKey: string; baseURL?: string }) {}
	},
}));

import { OpenAICompatibleAdapter } from "@/agent/providers/openai-compatible";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_CONFIG: ProviderConfig = {
	provider: "openai-compatible",
	apiKey: "sk-test",
	model: "gpt-4o-mini",
};

const SIMPLE_TOOLS: ToolDefinition[] = [
	{
		name: "test_tool",
		description: "A test tool",
		parameters: [{ key: "input", type: "string", required: true }],
		execute: async () => ({}),
	},
];

function makeOpenAIResponse(overrides: {
	content?: string;
	toolCalls?: Array<{ id: string; name: string; arguments: string }>;
}) {
	return {
		choices: [
			{
				message: {
					content: overrides.content ?? "Hello!",
					tool_calls: overrides.toolCalls?.map((tc) => ({
						id: tc.id,
						type: "function",
						function: { name: tc.name, arguments: tc.arguments },
					})),
				},
			},
		],
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("OpenAICompatibleAdapter.chat()", () => {
	beforeEach(() => {
		mockCreate.mockReset();
	});

	test("returns content-only response", async () => {
		mockCreate.mockResolvedValueOnce(
			makeOpenAIResponse({ content: "Hi there!" }),
		);

		const adapter = new OpenAICompatibleAdapter(TEST_CONFIG);
		const result = await adapter.chat({
			messages: [{ id: "1", role: "user", content: "Hey", timestamp: 0 }],
			systemPrompt: "You are helpful.",
			tools: [],
		});

		expect(result.content).toBe("Hi there!");
		expect(result.toolCalls).toBeUndefined();
	});

	test("returns tool calls from provider response", async () => {
		mockCreate.mockResolvedValueOnce(
			makeOpenAIResponse({
				content: "",
				toolCalls: [
					{
						id: "tc_1",
						name: "test_tool",
						arguments: '{"input":"hello"}',
					},
				],
			}),
		);

		const adapter = new OpenAICompatibleAdapter(TEST_CONFIG);
		const result = await adapter.chat({
			messages: [{ id: "1", role: "user", content: "Run tool", timestamp: 0 }],
			systemPrompt: "System",
			tools: SIMPLE_TOOLS,
		});

		expect(result.content).toBe("");
		expect(result.toolCalls).toHaveLength(1);
		expect(result.toolCalls?.[0]).toEqual({
			id: "tc_1",
			name: "test_tool",
			args: { input: "hello" },
		});
	});

	test("maps array parameter schemas to OpenAI format", async () => {
		mockCreate.mockResolvedValueOnce(makeOpenAIResponse({ content: "ok" }));

		const adapter = new OpenAICompatibleAdapter(TEST_CONFIG);
		await adapter.chat({
			messages: [{ id: "1", role: "user", content: "Run tool", timestamp: 0 }],
			systemPrompt: "System",
			tools: [
				{
					name: "delete_timeline_elements",
					description: "Delete elements",
					parameters: [
						{ key: "elementIds", type: "string[]", required: true },
						{ key: "times", type: "number[]", required: false },
					],
				},
			],
		});

		const callArgs = mockCreate.mock.calls[0][0] as {
			tools: Array<{
				function: {
					parameters: {
						properties: Record<
							string,
							{ type: string; items?: { type: string } }
						>;
					};
				};
			}>;
		};

		const props = callArgs.tools[0].function.parameters.properties;
		expect(props.elementIds).toEqual({
			type: "array",
			items: { type: "string" },
		});
		expect(props.times).toEqual({
			type: "array",
			items: { type: "number" },
		});
	});

	test("prepends system prompt as first message", async () => {
		mockCreate.mockResolvedValueOnce(makeOpenAIResponse({ content: "ok" }));

		const adapter = new OpenAICompatibleAdapter(TEST_CONFIG);
		await adapter.chat({
			messages: [{ id: "1", role: "user", content: "Hi", timestamp: 0 }],
			systemPrompt: "Custom system prompt",
			tools: [],
		});

		const callArgs = mockCreate.mock.calls[0][0] as {
			messages: Array<Record<string, unknown>>;
		};
		expect(callArgs.messages[0]).toEqual({
			role: "system",
			content: "Custom system prompt",
		});
	});

	test("converts user messages to OpenAI format", async () => {
		mockCreate.mockResolvedValueOnce(makeOpenAIResponse({ content: "ok" }));

		const adapter = new OpenAICompatibleAdapter(TEST_CONFIG);
		await adapter.chat({
			messages: [{ id: "1", role: "user", content: "Hello", timestamp: 0 }],
			systemPrompt: "System",
			tools: [],
		});

		const callArgs = mockCreate.mock.calls[0][0] as {
			messages: Array<Record<string, unknown>>;
		};
		// messages[0] is system, messages[1] is user
		expect(callArgs.messages[1]).toEqual({
			role: "user",
			content: "Hello",
		});
	});

	test("converts assistant messages with tool calls", async () => {
		mockCreate.mockResolvedValueOnce(makeOpenAIResponse({ content: "ok" }));

		const adapter = new OpenAICompatibleAdapter(TEST_CONFIG);
		await adapter.chat({
			messages: [
				{
					id: "1",
					role: "assistant",
					content: "Let me check.",
					toolCalls: [{ id: "tc_1", name: "test_tool", args: { input: "x" } }],
					timestamp: 0,
				},
			],
			systemPrompt: "System",
			tools: [],
		});

		const callArgs = mockCreate.mock.calls[0][0] as {
			messages: Array<Record<string, unknown>>;
		};
		const assistantMsg = callArgs.messages[1];
		expect(assistantMsg.role).toBe("assistant");
		expect(assistantMsg.content).toBe("Let me check.");
		expect(assistantMsg.tool_calls).toEqual([
			{
				id: "tc_1",
				type: "function",
				function: { name: "test_tool", arguments: '{"input":"x"}' },
			},
		]);
	});

	test("converts tool_result messages to OpenAI tool format", async () => {
		mockCreate.mockResolvedValueOnce(makeOpenAIResponse({ content: "ok" }));

		const adapter = new OpenAICompatibleAdapter(TEST_CONFIG);
		await adapter.chat({
			messages: [
				{
					id: "1",
					role: "tool_result",
					content: '{"result":"data"}',
					toolCallId: "tc_1",
					timestamp: 0,
				},
			],
			systemPrompt: "System",
			tools: [],
		});

		const callArgs = mockCreate.mock.calls[0][0] as {
			messages: Array<Record<string, unknown>>;
		};
		expect(callArgs.messages[1]).toEqual({
			role: "tool",
			tool_call_id: "tc_1",
			content: '{"result":"data"}',
		});
	});

	test("converts tool definitions to OpenAI function format", async () => {
		mockCreate.mockResolvedValueOnce(makeOpenAIResponse({ content: "ok" }));

		const adapter = new OpenAICompatibleAdapter(TEST_CONFIG);
		await adapter.chat({
			messages: [{ id: "1", role: "user", content: "Go", timestamp: 0 }],
			systemPrompt: "System",
			tools: SIMPLE_TOOLS,
		});

		const callArgs = mockCreate.mock.calls[0][0] as {
			tools: Array<Record<string, unknown>>;
		};
		expect(callArgs.tools).toHaveLength(1);
		expect(callArgs.tools[0]).toEqual({
			type: "function",
			function: {
				name: "test_tool",
				description: "A test tool",
				parameters: {
					type: "object",
					properties: { input: { type: "string" } },
					required: ["input"],
				},
			},
		});
	});

	test("throws when provider returns empty choices", async () => {
		mockCreate.mockResolvedValueOnce({ choices: [] });

		const adapter = new OpenAICompatibleAdapter(TEST_CONFIG);

		expect(
			adapter.chat({
				messages: [{ id: "1", role: "user", content: "Hi", timestamp: 0 }],
				systemPrompt: "System",
				tools: [],
			}),
		).rejects.toThrow("Empty response from AI provider");
	});

	test("defaults content to empty string when null", async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [{ message: { content: null } }],
		});

		const adapter = new OpenAICompatibleAdapter(TEST_CONFIG);
		const result = await adapter.chat({
			messages: [{ id: "1", role: "user", content: "Hi", timestamp: 0 }],
			systemPrompt: "System",
			tools: [],
		});

		expect(result.content).toBe("");
		expect(result.toolCalls).toBeUndefined();
	});

	test("passes model from config to API call", async () => {
		mockCreate.mockResolvedValueOnce(makeOpenAIResponse({ content: "ok" }));

		const adapter = new OpenAICompatibleAdapter(TEST_CONFIG);
		await adapter.chat({
			messages: [{ id: "1", role: "user", content: "Hi", timestamp: 0 }],
			systemPrompt: "System",
			tools: [],
		});

		const callArgs = mockCreate.mock.calls[0][0] as { model: string };
		expect(callArgs.model).toBe("gpt-4o-mini");
	});
});
