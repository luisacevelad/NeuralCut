import { beforeEach, describe, expect, jest, test } from "bun:test";
import { SchemaType, type GenerateContentResult } from "@google/generative-ai";
import type { ProviderConfig } from "@/agent/providers/types";
import type { ToolSchema } from "@/agent/types";

// ---------------------------------------------------------------------------
// Mock the Google Generative AI SDK before the adapter module loads
// ---------------------------------------------------------------------------

const mockGenerateContent = jest.fn();

jest.mock("@google/generative-ai", () => ({
	GoogleGenerativeAI: class MockGoogleGenerativeAI {
		getGenerativeModel(_opts: { model: string }) {
			return { generateContent: mockGenerateContent };
		}
		constructor(_opts: { apiKey: string }) {}
	},
	SchemaType: {
		STRING: "string",
		NUMBER: "number",
		BOOLEAN: "boolean",
		OBJECT: "object",
	},
}));

// Import after mock is set up
import {
	GeminiAdapter,
	toGeminiContents,
	toGeminiTools,
	fromGeminiResponse,
} from "@/agent/providers/gemini";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_CONFIG: ProviderConfig = {
	provider: "gemini",
	apiKey: "test-gemini-key",
	model: "gemini-2.0-flash",
};

const SAMPLE_TOOLS: ToolSchema[] = [
	{
		name: "transcribe_video",
		description: "Transcribes a video asset",
		parameters: [
			{ key: "assetId", type: "string", required: true },
			{ key: "language", type: "string", required: false },
		],
	},
];

function makeGeminiResponse(overrides: {
	text?: string;
	functionCalls?: Array<{
		name: string;
		args: Record<string, unknown>;
		thoughtSignature?: string;
	}>;
}): GenerateContentResult {
	const parts: Array<Record<string, unknown>> = [];

	if (overrides.text !== undefined) {
		parts.push({ text: overrides.text });
	}

	if (overrides.functionCalls) {
		for (const fc of overrides.functionCalls) {
			parts.push({
				functionCall: { name: fc.name, args: fc.args },
				...(fc.thoughtSignature
					? { thoughtSignature: fc.thoughtSignature }
					: {}),
			});
		}
	}

	return {
		response: {
			candidates: [
				{
					content: { parts },
				},
			],
		},
	} as unknown as GenerateContentResult;
}

function makeChatMessage(
	role: "user" | "assistant" | "system" | "tool_result",
	content: string,
	extra?: Record<string, unknown>,
) {
	return {
		id: `msg-${Math.random().toString(36).slice(2)}`,
		role,
		content,
		timestamp: Date.now(),
		...extra,
	};
}

// ---------------------------------------------------------------------------
// Tests: toGeminiContents (Task 4.1)
// ---------------------------------------------------------------------------

describe("toGeminiContents", () => {
	test("maps user message to Gemini user role", () => {
		const messages = [makeChatMessage("user", "Hello")];
		const contents = toGeminiContents(messages);

		expect(contents).toHaveLength(1);
		expect(contents[0].role).toBe("user");
		expect(contents[0].parts).toEqual([{ text: "Hello" }]);
	});

	test("maps assistant message to Gemini model role", () => {
		const messages = [makeChatMessage("assistant", "Hi there!")];
		const contents = toGeminiContents(messages);

		expect(contents).toHaveLength(1);
		expect(contents[0].role).toBe("model");
		expect(contents[0].parts).toEqual([{ text: "Hi there!" }]);
	});

	test("maps assistant with toolCalls to model role with functionCall parts", () => {
		const messages = [
			makeChatMessage("assistant", "Let me check.", {
				toolCalls: [
					{
						id: "tc_1",
						name: "transcribe_video",
						args: { assetId: "vid-123" },
					},
				],
			}),
		];
		const contents = toGeminiContents(messages);

		expect(contents).toHaveLength(1);
		expect(contents[0].role).toBe("model");
		expect(contents[0].parts as unknown).toEqual([
			{ text: "Let me check." },
			{
				functionCall: {
					name: "transcribe_video",
					args: { assetId: "vid-123" },
				},
			},
		]);
	});

	test("preserves Gemini thought signatures on assistant tool calls", () => {
		const messages = [
			makeChatMessage("assistant", "", {
				toolCalls: [
					{
						id: "tc_1",
						name: "load_context",
						args: { targetType: "asset", assetId: "asset-1" },
						thoughtSignature: "sig-abc",
					},
				],
			}),
		];

		const contents = toGeminiContents(messages);

		expect(contents[0].parts as unknown).toEqual([
			{
				functionCall: {
					name: "load_context",
					args: { targetType: "asset", assetId: "asset-1" },
				},
				thoughtSignature: "sig-abc",
			},
		]);
	});

	test("maps tool_result to function role with functionResponse", () => {
		const messages = [
			makeChatMessage("assistant", "", {
				toolCalls: [
					{
						id: "tc_1",
						name: "transcribe_video",
						args: { assetId: "vid-123" },
					},
				],
			}),
			makeChatMessage("tool_result", '{"transcript": "Hello world"}', {
				toolCallId: "tc_1",
			}),
		];
		const contents = toGeminiContents(messages);

		// First: model (assistant with toolCalls)
		expect(contents[0].role).toBe("model");
		// Second: function (tool_result)
		expect(contents[1].role).toBe("function");
		expect(contents[1].parts).toEqual([
			{
				functionResponse: {
					name: "transcribe_video",
					response: { transcript: "Hello world" },
				},
			},
		]);
	});

	test("excludes system messages from contents", () => {
		const messages = [
			makeChatMessage("system", "You are a video editor."),
			makeChatMessage("user", "Hello"),
		];
		const contents = toGeminiContents(messages);

		expect(contents).toHaveLength(1);
		expect(contents[0].role).toBe("user");
	});

	test("handles tool_result with non-JSON content by wrapping in object", () => {
		const messages = [
			makeChatMessage("assistant", "", {
				toolCalls: [{ id: "tc_1", name: "some_tool", args: {} }],
			}),
			makeChatMessage("tool_result", "plain text result", {
				toolCallId: "tc_1",
			}),
		];
		const contents = toGeminiContents(messages);

		expect(contents[1].parts).toEqual([
			{
				functionResponse: {
					name: "some_tool",
					response: { result: "plain text result" },
				},
			},
		]);
	});

	test("adds fileData part for loaded media context tool results", () => {
		const messages = [
			makeChatMessage("assistant", "", {
				toolCalls: [{ id: "tc_1", name: "load_context", args: {} }],
			}),
			makeChatMessage(
				"tool_result",
				JSON.stringify({
					context: {
						kind: "media",
						assetName: "intro.mp4",
						fileUri: "gemini://files/abc",
						mimeType: "video/mp4",
					},
				}),
				{ toolCallId: "tc_1" },
			),
		];

		const contents = toGeminiContents(messages);

		expect(contents[1].role).toBe("function");
		expect(contents[2]).toEqual({
			role: "user",
			parts: [
				{
					text: expect.stringContaining(
						"The attached fileData is the actual media file",
					),
				},
				{
					fileData: {
						fileUri: "gemini://files/abc",
						mimeType: "video/mp4",
					},
				},
			],
		});
	});
});

// ---------------------------------------------------------------------------
// Tests: toGeminiTools (Task 4.2)
// ---------------------------------------------------------------------------

describe("toGeminiTools", () => {
	test("converts a single tool with parameters", () => {
		const declarations = toGeminiTools(SAMPLE_TOOLS);

		expect(declarations).toHaveLength(1);
		expect(declarations[0].name).toBe("transcribe_video");
		expect(declarations[0].description).toBe("Transcribes a video asset");
		expect(declarations[0].parameters?.type).toBe(SchemaType.OBJECT);
		expect(declarations[0].parameters?.properties).toHaveProperty("assetId");
		expect(declarations[0].parameters?.required).toEqual(["assetId"]);
	});

	test("maps type strings to Gemini SchemaType values", () => {
		const tools: ToolSchema[] = [
			{
				name: "multi_param_tool",
				description: "Tool with all param types",
				parameters: [
					{ key: "name", type: "string", required: true },
					{ key: "count", type: "number", required: false },
					{ key: "active", type: "boolean", required: false },
					{ key: "meta", type: "object", required: false },
				],
			},
		];

		const declarations = toGeminiTools(tools);
		const props = declarations[0].parameters?.properties as Record<
			string,
			{ type: string }
		>;

		expect(props.name.type).toBe(SchemaType.STRING);
		expect(props.count.type).toBe(SchemaType.NUMBER);
		expect(props.active.type).toBe(SchemaType.BOOLEAN);
		expect(props.meta.type).toBe(SchemaType.OBJECT);
	});

	test("returns empty array when no tools provided", () => {
		expect(toGeminiTools([])).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Tests: fromGeminiResponse (Task 4.3)
// ---------------------------------------------------------------------------

describe("fromGeminiResponse", () => {
	test("extracts text-only response with no toolCalls", () => {
		const response = makeGeminiResponse({ text: "Hello from Gemini!" });
		const result = fromGeminiResponse(response);

		expect(result.content).toBe("Hello from Gemini!");
		expect(result.toolCalls).toBeUndefined();
	});

	test("maps function-call response to toolCalls with non-empty synthesized IDs", () => {
		const response = makeGeminiResponse({
			text: undefined,
			functionCalls: [
				{
					name: "transcribe_video",
					args: { assetId: "vid-1" },
					thoughtSignature: "sig-123",
				},
			],
		});
		const result = fromGeminiResponse(response);

		expect(result.content).toBe("");
		expect(result.toolCalls).toHaveLength(1);
		expect(result.toolCalls?.[0].name).toBe("transcribe_video");
		expect(result.toolCalls?.[0].args).toEqual({ assetId: "vid-1" });
		expect(result.toolCalls?.[0].thoughtSignature).toBe("sig-123");
		// Non-empty synthesized ID
		expect(result.toolCalls?.[0].id).toBeTruthy();
		expect(typeof result.toolCalls?.[0].id).toBe("string");
	});

	test("two calls produce different IDs", () => {
		const response1 = makeGeminiResponse({
			functionCalls: [{ name: "tool_a", args: {} }],
		});
		const response2 = makeGeminiResponse({
			functionCalls: [{ name: "tool_a", args: {} }],
		});

		const result1 = fromGeminiResponse(response1);
		const result2 = fromGeminiResponse(response2);

		expect(result1.toolCalls?.[0].id).not.toBe(result2.toolCalls?.[0].id);
	});

	test("handles mixed text and function-call parts", () => {
		const response = makeGeminiResponse({
			text: "I'll look that up.",
			functionCalls: [{ name: "search", args: { q: "test" } }],
		});
		const result = fromGeminiResponse(response);

		expect(result.content).toBe("I'll look that up.");
		expect(result.toolCalls).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// Tests: error paths (Task 4.4)
// ---------------------------------------------------------------------------

describe("error paths", () => {
	test("throws on empty candidates", () => {
		const response = {
			response: { candidates: [] },
		};

		expect(() => fromGeminiResponse(response as any)).toThrow(
			"Empty response from Gemini provider",
		);
	});

	test("throws on null candidates", () => {
		const response = {
			response: { candidates: null },
		};

		expect(() => fromGeminiResponse(response as any)).toThrow(
			"Empty response from Gemini provider",
		);
	});

	test("SDK error propagates from chat()", async () => {
		mockGenerateContent.mockRejectedValueOnce(new Error("API key not valid"));

		const adapter = new GeminiAdapter(TEST_CONFIG);

		expect(
			adapter.chat({
				messages: [makeChatMessage("user", "Hello")],
				systemPrompt: "",
				tools: [],
			}),
		).rejects.toThrow("API key not valid");
	});
});

// ---------------------------------------------------------------------------
// Tests: full chat() round-trip (Task 4.6)
// ---------------------------------------------------------------------------

describe("GeminiAdapter.chat()", () => {
	beforeEach(() => {
		mockGenerateContent.mockReset();
	});

	test("calls generateContent with correct contents and no tools", async () => {
		mockGenerateContent.mockResolvedValueOnce(
			makeGeminiResponse({ text: "Hi!" }),
		);

		const adapter = new GeminiAdapter(TEST_CONFIG);
		const result = await adapter.chat({
			messages: [makeChatMessage("user", "Hello")],
			systemPrompt: "You are helpful.",
			tools: [],
		});

		expect(result.content).toBe("Hi!");
		expect(result.toolCalls).toBeUndefined();

		const callArgs = mockGenerateContent.mock.calls[0][0];
		expect(callArgs.contents).toHaveLength(1);
		expect(callArgs.contents[0].role).toBe("user");
		expect(callArgs.systemInstruction).toBe("You are helpful.");
		expect(callArgs.tools).toBeUndefined();
	});

	test("calls generateContent with tools and systemInstruction", async () => {
		mockGenerateContent.mockResolvedValueOnce(
			makeGeminiResponse({
				functionCalls: [
					{
						name: "transcribe_video",
						args: { assetId: "vid-1" },
					},
				],
			}),
		);

		const adapter = new GeminiAdapter(TEST_CONFIG);
		const result = await adapter.chat({
			messages: [makeChatMessage("user", "Transcribe this")],
			systemPrompt: "Video editing assistant",
			tools: SAMPLE_TOOLS,
		});

		expect(result.toolCalls).toHaveLength(1);
		expect(result.toolCalls?.[0].name).toBe("transcribe_video");

		const callArgs = mockGenerateContent.mock.calls[0][0];
		expect(callArgs.systemInstruction).toBe("Video editing assistant");
		expect(callArgs.tools).toHaveLength(1);
		expect(callArgs.tools[0].functionDeclarations).toHaveLength(1);
	});

	test("passes multi-turn conversation through to Gemini", async () => {
		mockGenerateContent.mockResolvedValueOnce(
			makeGeminiResponse({ text: "Sure!" }),
		);

		const adapter = new GeminiAdapter(TEST_CONFIG);
		await adapter.chat({
			messages: [
				makeChatMessage("user", "First question"),
				makeChatMessage("assistant", "First answer"),
				makeChatMessage("user", "Second question"),
			],
			systemPrompt: "",
			tools: [],
		});

		const callArgs = mockGenerateContent.mock.calls[0][0];
		expect(callArgs.contents).toHaveLength(3);
		expect(callArgs.contents[0].role).toBe("user");
		expect(callArgs.contents[1].role).toBe("model");
		expect(callArgs.contents[2].role).toBe("user");
	});

	test("does not include systemInstruction when systemPrompt is empty", async () => {
		mockGenerateContent.mockResolvedValueOnce(
			makeGeminiResponse({ text: "OK" }),
		);

		const adapter = new GeminiAdapter(TEST_CONFIG);
		await adapter.chat({
			messages: [makeChatMessage("user", "Hi")],
			systemPrompt: "",
			tools: [],
		});

		const callArgs = mockGenerateContent.mock.calls[0][0];
		expect(callArgs.systemInstruction).toBeUndefined();
	});

	test("ignores baseUrl in config — Gemini still works", async () => {
		mockGenerateContent.mockResolvedValueOnce(
			makeGeminiResponse({ text: "Hello!" }),
		);

		const configWithBaseUrl: ProviderConfig = {
			provider: "gemini",
			apiKey: "test-gemini-key",
			model: "gemini-2.0-flash",
			baseUrl: "https://should-be-ignored.example.com",
		};

		const adapter = new GeminiAdapter(configWithBaseUrl);
		const result = await adapter.chat({
			messages: [makeChatMessage("user", "Hi")],
			systemPrompt: "",
			tools: [],
		});

		expect(result.content).toBe("Hello!");
		expect(result.toolCalls).toBeUndefined();
	});

	test("returns text when tools are provided but Gemini responds with text only", async () => {
		mockGenerateContent.mockResolvedValueOnce(
			makeGeminiResponse({ text: "I don't need any tools for this." }),
		);

		const adapter = new GeminiAdapter(TEST_CONFIG);
		const result = await adapter.chat({
			messages: [makeChatMessage("user", "Just chat")],
			systemPrompt: "You are helpful.",
			tools: SAMPLE_TOOLS,
		});

		expect(result.content).toBe("I don't need any tools for this.");
		expect(result.toolCalls).toBeUndefined();

		// Verify tools were still sent to Gemini
		const callArgs = mockGenerateContent.mock.calls[0][0];
		expect(callArgs.tools).toBeDefined();
		expect(callArgs.tools[0].functionDeclarations).toHaveLength(1);
	});

	test("retries transient provider failures before returning content", async () => {
		const providerError = Object.assign(new Error("Service Unavailable"), {
			status: 503,
		});
		mockGenerateContent
			.mockRejectedValueOnce(providerError)
			.mockRejectedValueOnce(providerError)
			.mockResolvedValueOnce(makeGeminiResponse({ text: "Recovered" }));

		const adapter = new GeminiAdapter(TEST_CONFIG);
		const result = await adapter.chat({
			messages: [makeChatMessage("user", "Hi")],
			systemPrompt: "",
			tools: [],
		});

		expect(result.content).toBe("Recovered");
		expect(mockGenerateContent).toHaveBeenCalledTimes(3);
	});

	test("does not retry non-transient provider failures", async () => {
		const providerError = Object.assign(new Error("Bad request"), {
			status: 400,
		});
		mockGenerateContent.mockRejectedValueOnce(providerError);

		const adapter = new GeminiAdapter(TEST_CONFIG);
		await expect(
			adapter.chat({
				messages: [makeChatMessage("user", "Hi")],
				systemPrompt: "",
				tools: [],
			}),
		).rejects.toThrow("Bad request");

		expect(mockGenerateContent).toHaveBeenCalledTimes(1);
	});
});
