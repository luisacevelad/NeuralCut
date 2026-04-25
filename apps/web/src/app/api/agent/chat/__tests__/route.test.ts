import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import { POST } from "@/app/api/agent/chat/route";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock the provider module — route never touches the real SDK
// ---------------------------------------------------------------------------

const mockChat = jest.fn();

jest.mock("@/agent/providers", () => ({
	createProvider: () => ({
		chat: mockChat,
	}),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown): NextRequest {
	return new NextRequest("http://localhost/api/agent/chat", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

const VALID_CONTEXT = {
	projectId: null,
	activeSceneId: null,
	mediaAssets: [] as Array<{
		id: string;
		name: string;
		type: string;
		duration: number;
		usedInTimeline?: boolean;
	}>,
	timelineTracks: undefined as
		| Array<{
				trackId: string;
				type: "main" | "overlay" | "audio" | "text" | "effect";
				position: number;
				visualLayer: number | null;
				isVisualLayer: boolean;
				stacking: "top" | "above_main" | "main" | "audio";
				elements: Array<{
					elementId: string;
					type: string;
					assetId?: string;
					name?: string;
					content?: string;
					start: number;
					end: number;
				}>;
		  }>
		| undefined,
	playbackTimeMs: 0,
};

const VALID_BODY = {
	messages: [
		{
			id: "msg_1",
			role: "user" as const,
			content: "Hello",
			timestamp: Date.now(),
		},
	],
	context: VALID_CONTEXT,
};

const savedEnv: Record<string, string | undefined> = {};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/agent/chat", () => {
	beforeEach(() => {
		mockChat.mockReset();

		// Save and set LLM_* env vars
		for (const key of [
			"LLM_PROVIDER",
			"LLM_API_KEY",
			"LLM_MODEL",
			"LLM_BASE_URL",
		]) {
			savedEnv[key] = process.env[key];
		}
		process.env.LLM_PROVIDER = "openai-compatible";
		process.env.LLM_API_KEY = "sk-test";
		process.env.LLM_MODEL = "gpt-4o-mini";
		delete process.env.LLM_BASE_URL;
	});

	afterEach(() => {
		// Restore env vars
		for (const [key, value] of Object.entries(savedEnv)) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	});

	// -----------------------------------------------------------------------
	// 200 paths
	// -----------------------------------------------------------------------

	test("returns 200 with content for valid request", async () => {
		mockChat.mockResolvedValueOnce({
			content: "Hello! How can I help?",
			toolCalls: undefined,
		});

		const res = await POST(makeRequest(VALID_BODY));
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data.content).toBe("Hello! How can I help?");
		expect(data.toolCalls).toBeUndefined();
	});

	test("returns 200 with toolCalls when provider returns them", async () => {
		mockChat.mockResolvedValueOnce({
			content: "",
			toolCalls: [{ id: "tc_1", name: "transcribe_video", args: {} }],
		});

		const res = await POST(makeRequest(VALID_BODY));
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data.content).toBe("");
		expect(data.toolCalls).toHaveLength(1);
		expect(data.toolCalls[0].name).toBe("transcribe_video");
	});

	test("passes messages, systemPrompt and tools to adapter", async () => {
		mockChat.mockResolvedValueOnce({ content: "ok" });

		await POST(makeRequest(VALID_BODY));

		const callArgs = mockChat.mock.calls[0][0] as {
			messages: unknown[];
			systemPrompt: string;
			tools: unknown[];
		};

		expect(callArgs.messages).toHaveLength(1);
		expect(callArgs.systemPrompt).toContain("NeuralCut");
		expect(callArgs.tools).toHaveLength(5);
		expect(
			callArgs.tools.map((tool) => (tool as { name: string }).name),
		).toEqual([
			"load_context",
			"list_project_assets",
			"list_timeline",
			"split",
			"delete_timeline_elements",
		]);
	});

	// -----------------------------------------------------------------------
	// 400 paths
	// -----------------------------------------------------------------------

	test("returns 400 for missing messages", async () => {
		const res = await POST(makeRequest({ context: VALID_CONTEXT }));
		expect(res.status).toBe(400);

		const data = await res.json();
		expect(data.error).toBe("Invalid input");
		expect(data.details).toBeDefined();
	});

	test("returns 400 for invalid role", async () => {
		const res = await POST(
			makeRequest({
				messages: [{ role: "invalid_role", content: "test" }],
				context: VALID_CONTEXT,
			}),
		);
		expect(res.status).toBe(400);
	});

	test("returns 400 for non-array messages", async () => {
		const res = await POST(
			makeRequest({ messages: "not an array", context: VALID_CONTEXT }),
		);
		expect(res.status).toBe(400);
	});

	test("returns 400 for missing context", async () => {
		const res = await POST(
			makeRequest({ messages: [{ role: "user", content: "Hi" }] }),
		);
		expect(res.status).toBe(400);
	});

	// -----------------------------------------------------------------------
	// 502 — missing env vars / provider config failures
	// -----------------------------------------------------------------------

	test("returns 502 when LLM_API_KEY is missing", async () => {
		delete process.env.LLM_API_KEY;

		const res = await POST(makeRequest(VALID_BODY));
		expect(res.status).toBe(502);

		const data = await res.json();
		expect(data.error).toContain("missing");
	});

	test("returns 502 when LLM_PROVIDER is missing", async () => {
		delete process.env.LLM_PROVIDER;

		const res = await POST(makeRequest(VALID_BODY));
		expect(res.status).toBe(502);
	});

	test("returns 502 when LLM_MODEL is missing", async () => {
		delete process.env.LLM_MODEL;

		const res = await POST(makeRequest(VALID_BODY));
		expect(res.status).toBe(502);
	});

	// -----------------------------------------------------------------------
	// 502 — provider error
	// -----------------------------------------------------------------------

	test("returns 502 when adapter throws", async () => {
		mockChat.mockRejectedValueOnce(new Error("Network timeout"));

		const res = await POST(makeRequest(VALID_BODY));
		expect(res.status).toBe(502);

		const data = await res.json();
		expect(data.error).toBe("LLM provider error");
	});

	test("returns clear error when Gemini credits are depleted", async () => {
		mockChat.mockRejectedValueOnce(
			Object.assign(
				new Error(
					"[GoogleGenerativeAI Error]: [429 Too Many Requests] Your prepayment credits are depleted.",
				),
				{ status: 429 },
			),
		);

		const res = await POST(makeRequest(VALID_BODY));
		expect(res.status).toBe(402);

		const data = await res.json();
		expect(data.error).toContain("Gemini credits are depleted");
		expect(data.providerStatus).toBe(429);
	});
});
