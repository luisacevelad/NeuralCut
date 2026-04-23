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

	// Mock intent detection: keyword match on last user message
	const lastUserMessage = [...result.data.messages]
		.reverse()
		.find((m) => m.role === "user");
	const isTranscriptionRequest =
		lastUserMessage?.content.toLowerCase().includes("transcri") ?? false;

	if (isTranscriptionRequest) {
		return NextResponse.json({
			content: "I'll transcribe your video now.",
			toolCalls: [
				{
					id: "tc_transcribe_1",
					name: "transcribe_video",
					args: {},
				},
			],
		});
	}

	// Default: echo_context fallback
	return NextResponse.json({
		content: "Let me check your editor context.",
		toolCalls: [
			{
				id: "mock_tc_1",
				name: "echo_context",
				args: {},
			},
		],
	});
}
