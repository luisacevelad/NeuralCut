import { beforeEach, describe, expect, test } from "bun:test";
import { useChatStore } from "@/stores/chat-store";
import { useAgentStore } from "@/stores/agent-store";
import { useRightPanelStore } from "@/stores/right-panel-store";
import type { AgentContext } from "@/agent/types";

/**
 * ChatPanel behavioral scenarios — store-level evidence.
 *
 * These tests verify the state management logic that drives ChatPanel rendering.
 * The ChatPanel is a thin React shell over these stores: if the stores behave
 * correctly, the UI renders correctly (it's a direct store→JSX mapping).
 *
 * No React testing library is required — these are pure store tests that
 * prove the behavioral contracts the ChatPanel depends on.
 */

const MOCK_CONTEXT: AgentContext = {
	projectId: "proj-1",
	activeSceneId: "scene-A",
	mediaAssets: [],
	playbackTimeMs: 0,
};

describe("ChatPanel behavioral scenarios", () => {
	beforeEach(() => {
		useChatStore.getState().clearMessages();
		useAgentStore.getState().reset();
		useRightPanelStore.getState().setActiveTab("properties");
	});

	describe("Tabbed Panel Placement", () => {
		test("default state on editor load — properties tab is active", () => {
			expect(useRightPanelStore.getState().activeTab).toBe("properties");
		});

		test("user switches to chat tab — activeTab changes to chat", () => {
			useRightPanelStore.getState().setActiveTab("chat");
			expect(useRightPanelStore.getState().activeTab).toBe("chat");
		});
	});

	describe("Message Display", () => {
		test("messages render in order — chatStore preserves chronological order", () => {
			const { addMessage } = useChatStore.getState();

			addMessage({ role: "user", content: "First" });
			addMessage({ role: "assistant", content: "Second" });
			addMessage({ role: "user", content: "Third" });

			const messages = useChatStore.getState().messages;
			expect(messages).toHaveLength(3);
			expect(messages[0].content).toBe("First");
			expect(messages[0].role).toBe("user");
			expect(messages[1].content).toBe("Second");
			expect(messages[1].role).toBe("assistant");
			expect(messages[2].content).toBe("Third");
			expect(messages[2].role).toBe("user");
		});

		test("empty state — messages array is empty by default", () => {
			expect(useChatStore.getState().messages).toEqual([]);
			expect(useChatStore.getState().loading).toBe(false);
			expect(useChatStore.getState().error).toBeNull();
		});

		test("each message has required fields for rendering (id, role, content, timestamp)", () => {
			useChatStore.getState().addMessage({ role: "user", content: "Test" });

			const msg = useChatStore.getState().messages[0];
			expect(msg.id).toBeTruthy();
			expect(msg.role).toBe("user");
			expect(msg.content).toBe("Test");
			expect(typeof msg.timestamp).toBe("number");
			expect(msg.timestamp).toBeGreaterThan(0);
		});
	});

	describe("Message Input and Submission", () => {
		test("user sends a message — user message appended, loading=true, error cleared", () => {
			// Pre-set an error to verify it gets cleared
			useChatStore.getState().setError("Previous error");

			useChatStore.getState().sendMessage("Describe the current scene");

			const state = useChatStore.getState();
			expect(state.messages).toHaveLength(1);
			expect(state.messages[0].role).toBe("user");
			expect(state.messages[0].content).toBe("Describe the current scene");
			expect(state.loading).toBe(true);
			expect(state.error).toBeNull();
		});

		test("input disabled during loading — loading state is true", () => {
			useChatStore.getState().sendMessage("Hello");
			expect(useChatStore.getState().loading).toBe(true);

			// Simulate orchestrator completing
			useChatStore.getState().setLoading(false);
			expect(useChatStore.getState().loading).toBe(false);
		});
	});

	describe("Loading and Error States", () => {
		test("loading indicator — loading state transitions correctly", () => {
			// Initially not loading
			expect(useChatStore.getState().loading).toBe(false);

			// After sendMessage, loading is true
			useChatStore.getState().sendMessage("Hello");
			expect(useChatStore.getState().loading).toBe(true);

			// After response, loading is cleared
			useChatStore.getState().setLoading(false);
			expect(useChatStore.getState().loading).toBe(false);
		});

		test("error displayed with retry — error lifecycle and retry flow", () => {
			// Simulate an error occurring
			useChatStore.getState().setError("Network error");

			const state = useChatStore.getState();
			expect(state.error).toBe("Network error");
			expect(state.loading).toBe(false);

			// Retry: clear error, set loading, re-run (simulated)
			useChatStore.getState().setError(null);
			useChatStore.getState().setLoading(true);

			const afterRetry = useChatStore.getState();
			expect(afterRetry.error).toBeNull();
			expect(afterRetry.loading).toBe(true);

			// Complete the retry
			useChatStore.getState().setLoading(false);
			expect(useChatStore.getState().loading).toBe(false);
		});

		test("error persists until explicitly cleared", () => {
			useChatStore.getState().setError("Something went wrong");

			// Error stays even after other operations
			useChatStore.getState().addMessage({ role: "assistant", content: "hi" });
			expect(useChatStore.getState().error).toBe("Something went wrong");

			// Only cleared by setError(null) or sendMessage
			useChatStore.getState().setError(null);
			expect(useChatStore.getState().error).toBeNull();
		});
	});

	describe("Full send → respond cycle", () => {
		test("complete user message → assistant response cycle at store level", () => {
			// 1. User sends message
			useChatStore.getState().sendMessage("Hello");
			expect(useChatStore.getState().messages).toHaveLength(1);
			expect(useChatStore.getState().loading).toBe(true);

			// 2. Orchestrator adds assistant response
			useChatStore.getState().addMessage({
				role: "assistant",
				content: "Hi there!",
			});
			useChatStore.getState().setLoading(false);

			// 3. Final state
			const finalState = useChatStore.getState();
			expect(finalState.messages).toHaveLength(2);
			expect(finalState.messages[0].role).toBe("user");
			expect(finalState.messages[1].role).toBe("assistant");
			expect(finalState.loading).toBe(false);
			expect(finalState.error).toBeNull();
		});
	});
});
