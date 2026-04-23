import { describe, expect, test } from "bun:test";
import { POST } from "@/app/api/agent/chat/route";
import { NextRequest } from "next/server";

function makeRequest(body: unknown): NextRequest {
	return new NextRequest("http://localhost/api/agent/chat", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("POST /api/agent/chat", () => {
	test("returns mock response for valid input", async () => {
		const req = makeRequest({
			messages: [{ role: "user", content: "Hello" }],
		});

		const res = await POST(req);
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data.content).toBe("Let me check your editor context.");
		expect(data.toolCalls).toHaveLength(1);
		expect(data.toolCalls[0].name).toBe("echo_context");
		expect(data.toolCalls[0].id).toBe("mock_tc_1");
	});

	test("returns 400 for invalid input — missing messages", async () => {
		const req = makeRequest({});

		const res = await POST(req);
		expect(res.status).toBe(400);

		const data = await res.json();
		expect(data.error).toBe("Invalid input");
		expect(data.details).toBeDefined();
	});

	test("returns 400 for invalid input — bad role", async () => {
		const req = makeRequest({
			messages: [{ role: "invalid_role", content: "test" }],
		});

		const res = await POST(req);
		expect(res.status).toBe(400);
	});

	test("accepts valid input with optional context", async () => {
		const req = makeRequest({
			messages: [{ role: "user", content: "Test" }],
			context: { projectId: "p1" },
		});

		const res = await POST(req);
		expect(res.status).toBe(200);
	});

	test("returns 400 for non-array messages", async () => {
		const req = makeRequest({
			messages: "not an array",
		});

		const res = await POST(req);
		expect(res.status).toBe(400);
	});
});
