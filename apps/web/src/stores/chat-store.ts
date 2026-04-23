import { create } from "zustand";
import { nanoid } from "nanoid";
import type { ChatMessage } from "@/agent/types";

interface ChatState {
	messages: ChatMessage[];
	loading: boolean;
	error: string | null;
	addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void;
	sendMessage: (content: string) => void;
	setLoading: (loading: boolean) => void;
	setError: (error: string | null) => void;
	clearMessages: () => void;
}

export const useChatStore = create<ChatState>()((set) => ({
	messages: [],
	loading: false,
	error: null,
	addMessage: (message) => {
		const full: ChatMessage = {
			...message,
			id: nanoid(),
			timestamp: Date.now(),
		};
		set((state) => ({ messages: [...state.messages, full] }));
	},
	sendMessage: (content) => {
		const userMessage: ChatMessage = {
			id: nanoid(),
			role: "user",
			content,
			timestamp: Date.now(),
		};
		set((state) => ({
			messages: [...state.messages, userMessage],
			loading: true,
			error: null,
		}));
	},
	setLoading: (loading) => set({ loading }),
	setError: (error) => set({ error, loading: false }),
	clearMessages: () => set({ messages: [], error: null, loading: false }),
}));
