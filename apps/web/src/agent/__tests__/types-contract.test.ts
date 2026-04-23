import { describe, expect, test } from "bun:test";
import type {
	ExecutionState,
	ChatMessage,
	ToolCall,
	ToolResult,
	AgentContext,
	ToolDefinition,
} from "@/agent/types";

describe("agent/types contracts", () => {
	test("ExecutionState accepts all valid states", () => {
		const states: ExecutionState[] = [
			"idle",
			"sending",
			"processing",
			"responding",
			"error",
		];
		expect(states).toHaveLength(5);
		for (const s of states) {
			expect(typeof s).toBe("string");
		}
	});

	test("ChatMessage shape is constructable", () => {
		const msg: ChatMessage = {
			id: "msg-1",
			role: "user",
			content: "Hello",
			timestamp: Date.now(),
		};
		expect(msg.id).toBe("msg-1");
		expect(msg.role).toBe("user");
		expect(msg.content).toBe("Hello");
		expect(typeof msg.timestamp).toBe("number");
	});

	test("ChatMessage with toolCalls is constructable", () => {
		const msg: ChatMessage = {
			id: "msg-2",
			role: "assistant",
			content: "Let me check",
			timestamp: Date.now(),
			toolCalls: [{ id: "tc-1", name: "echo_context", args: {} }],
		};
		expect(msg.toolCalls).toHaveLength(1);
		expect(msg.toolCalls?.[0].name).toBe("echo_context");
	});

	test("ToolCall shape is constructable", () => {
		const tc: ToolCall = {
			id: "tc-1",
			name: "some_tool",
			args: { key: "value" },
		};
		expect(tc.id).toBe("tc-1");
		expect(tc.name).toBe("some_tool");
		expect(tc.args).toEqual({ key: "value" });
	});

	test("ToolResult shape is constructable", () => {
		const tr: ToolResult = {
			toolCallId: "tc-1",
			name: "some_tool",
			result: { data: 42 },
		};
		expect(tr.toolCallId).toBe("tc-1");
		expect(tr.result).toEqual({ data: 42 });
		expect(tr.error).toBeUndefined();
	});

	test("ToolResult with error is constructable", () => {
		const tr: ToolResult = {
			toolCallId: "tc-2",
			name: "failing_tool",
			result: null,
			error: "Execution failed",
		};
		expect(tr.error).toBe("Execution failed");
	});

	test("AgentContext shape is constructable with media", () => {
		const ctx: AgentContext = {
			projectId: "proj-1",
			activeSceneId: "scene-A",
			mediaAssets: [
				{ id: "m1", name: "clip.mp4", type: "video", duration: 30 },
			],
			playbackTimeMs: 5000,
		};
		expect(ctx.projectId).toBe("proj-1");
		expect(ctx.mediaAssets).toHaveLength(1);
		expect(ctx.playbackTimeMs).toBe(5000);
	});

	test("AgentContext shape with null fields is constructable", () => {
		const ctx: AgentContext = {
			projectId: null,
			activeSceneId: null,
			mediaAssets: [],
			playbackTimeMs: 0,
		};
		expect(ctx.projectId).toBeNull();
		expect(ctx.activeSceneId).toBeNull();
		expect(ctx.mediaAssets).toEqual([]);
	});

	test("ToolDefinition shape is constructable", () => {
		const def: ToolDefinition = {
			name: "test_tool",
			description: "A test tool",
			parameters: [{ key: "input", type: "string", required: true }],
			execute: async () => ({ ok: true }),
		};
		expect(def.name).toBe("test_tool");
		expect(def.parameters).toHaveLength(1);
		expect(typeof def.execute).toBe("function");
	});

	test("all types are JSON-serializable", () => {
		const msg: ChatMessage = {
			id: "m1",
			role: "user",
			content: "hi",
			timestamp: 123,
		};
		const ctx: AgentContext = {
			projectId: "p1",
			activeSceneId: null,
			mediaAssets: [],
			playbackTimeMs: 0,
		};
		const tc: ToolCall = { id: "t1", name: "tool", args: {} };
		const tr: ToolResult = { toolCallId: "t1", name: "tool", result: 42 };

		// None of these should throw on serialization
		expect(() => JSON.stringify(msg)).not.toThrow();
		expect(() => JSON.stringify(ctx)).not.toThrow();
		expect(() => JSON.stringify(tc)).not.toThrow();
		expect(() => JSON.stringify(tr)).not.toThrow();

		// Round-trip preserves data
		expect(JSON.parse(JSON.stringify(ctx))).toEqual(ctx);
		expect(JSON.parse(JSON.stringify(tc))).toEqual(tc);
	});
});
