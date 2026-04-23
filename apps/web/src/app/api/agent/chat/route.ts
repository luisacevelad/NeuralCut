import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const chatRequestSchema = z.object({
	messages: z.array(
		z.object({
			role: z.enum(["user", "assistant", "tool_result"]),
			content: z.string(),
		}),
	),
	context: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
	const body = await request.json();
	const result = chatRequestSchema.safeParse(body);

	if (!result.success) {
		return NextResponse.json(
			{ error: "Invalid input", details: result.error.flatten().fieldErrors },
			{ status: 400 },
		);
	}

	// Phase 1: canned mock response with a tool call to validate the full pipeline
	const mockResponse = {
		content: "Let me check your editor context.",
		toolCalls: [
			{
				id: "mock_tc_1",
				name: "echo_context",
				args: {},
			},
		],
	};

	return NextResponse.json(mockResponse);
}
