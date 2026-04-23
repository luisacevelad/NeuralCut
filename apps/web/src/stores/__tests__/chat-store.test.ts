import { beforeEach, describe, expect, test } from "bun:test";
import { useChatStore } from "@/stores/chat-store";

describe("chatStore", () => {
	beforeEach(() => {
		useChatStore.getState().clearMessages();
	});

	test("addMessage appends a message with generated id and timestamp", () => {
		const { addMessage } = useChatStore.getState();
		addMessage({ role: "user", content: "Hello" });

		const messages = useChatStore.getState().messages;
		expect(messages).toHaveLength(1);
		expect(messages[0].role).toBe("user");
		expect(messages[0].content).toBe("Hello");
		expect(messages[0].id).toBeTruthy();
		expect(messages[0].timestamp).toBeGreaterThan(0);
	});

	test("addMessage preserves existing messages", () => {
		const { addMessage } = useChatStore.getState();
		addMessage({ role: "user", content: "First" });
		addMessage({ role: "assistant", content: "Second" });

		const messages = useChatStore.getState().messages;
		expect(messages).toHaveLength(2);
		expect(messages[0].content).toBe("First");
		expect(messages[1].content).toBe("Second");
	});

	test("sendMessage adds user message and sets loading", () => {
		const { sendMessage } = useChatStore.getState();
		sendMessage("Test message");

		const state = useChatStore.getState();
		expect(state.messages).toHaveLength(1);
		expect(state.messages[0].role).toBe("user");
		expect(state.messages[0].content).toBe("Test message");
		expect(state.loading).toBe(true);
		expect(state.error).toBeNull();
	});

	test("sendMessage clears previous error", () => {
		useChatStore.getState().setError("Previous error");
		expect(useChatStore.getState().error).toBe("Previous error");

		useChatStore.getState().sendMessage("New message");
		expect(useChatStore.getState().error).toBeNull();
	});

	test("setError sets error and clears loading", () => {
		useChatStore.getState().setLoading(true);
		expect(useChatStore.getState().loading).toBe(true);

		useChatStore.getState().setError("Something went wrong");
		const state = useChatStore.getState();
		expect(state.error).toBe("Something went wrong");
		expect(state.loading).toBe(false);
	});

	test("setError with null clears the error", () => {
		useChatStore.getState().setError("Error");
		expect(useChatStore.getState().error).toBe("Error");

		useChatStore.getState().setError(null);
		expect(useChatStore.getState().error).toBeNull();
	});

	test("setLoading toggles loading state", () => {
		useChatStore.getState().setLoading(true);
		expect(useChatStore.getState().loading).toBe(true);

		useChatStore.getState().setLoading(false);
		expect(useChatStore.getState().loading).toBe(false);
	});

	test("clearMessages resets all state", () => {
		const store = useChatStore.getState();
		store.addMessage({ role: "user", content: "Hi" });
		store.setError("err");
		store.setLoading(true);

		useChatStore.getState().clearMessages();
		const state = useChatStore.getState();
		expect(state.messages).toHaveLength(0);
		expect(state.error).toBeNull();
		expect(state.loading).toBe(false);
	});
});
