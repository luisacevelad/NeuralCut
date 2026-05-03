import { create } from "zustand";
import { nanoid } from "nanoid";
import type { ChatMessage, ChatSessionMeta } from "@/agent/types";
import { chatStorage } from "@/services/chat-storage";

function generateTitle(content: string): string {
	const cleaned = content.replace(/\s+/g, " ").trim();
	if (cleaned.length <= 50) return cleaned;
	return `${cleaned.slice(0, 50)}...`;
}

let saveTimeoutId: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(getState: () => ChatState) {
	if (saveTimeoutId !== null) {
		clearTimeout(saveTimeoutId);
	}
	saveTimeoutId = setTimeout(() => {
		const state = getState();
		persistActiveSession(state);
	}, 500);
}

async function persistActiveSession(state: ChatState) {
	if (!state.activeSessionId || !state.projectId) return;

	const session = state.sessions.find((s) => s.id === state.activeSessionId);
	if (!session) return;

	const meta: ChatSessionMeta = {
		...session,
		messageCount: state.messages.length,
		lastMessageAt:
			state.messages.length > 0
				? state.messages[state.messages.length - 1].timestamp
				: session.lastMessageAt,
	};

	chatStorage.saveSession(meta, state.messages).catch((err) => {
		console.error("Failed to save chat session:", err);
	});
}

interface ChatState {
	initialized: boolean;
	activeSessionId: string | null;
	sessions: ChatSessionMeta[];
	projectId: string | null;
	messages: ChatMessage[];
	loading: boolean;
	error: string | null;

	initProject: (projectId: string) => Promise<void>;
	switchSession: (sessionId: string) => Promise<void>;
	createSession: () => Promise<string>;
	deleteSession: (sessionId: string) => Promise<void>;
	renameSession: (sessionId: string, title: string) => Promise<void>;

	addMessage: (message: Omit<ChatMessage, "id" | "timestamp" | "sessionId">) => void;
	sendMessage: (content: string) => void;
	setLoading: (loading: boolean) => void;
	setError: (error: string | null) => void;
	clearMessages: () => void;
}

export const useChatStore = create<ChatState>()((set, get) => ({
	initialized: false,
	activeSessionId: null,
	sessions: [],
	projectId: null,
	messages: [],
	loading: false,
	error: null,

	initProject: async (projectId: string) => {
		try {
			const sessions = await chatStorage.loadSessionList(projectId);
			if (sessions.length > 0) {
				const messages = await chatStorage.loadSessionMessages(sessions[0].id);
				set({
					projectId,
					sessions,
					activeSessionId: sessions[0].id,
					messages,
					initialized: true,
					loading: false,
					error: null,
				});
			} else {
				const now = Date.now();
				const session: ChatSessionMeta = {
					id: nanoid(),
					projectId,
					title: "New chat",
					messageCount: 0,
					lastMessageAt: now,
					createdAt: now,
				};
				await chatStorage.saveSession(session, []);
				set({
					projectId,
					sessions: [session],
					activeSessionId: session.id,
					messages: [],
					initialized: true,
					loading: false,
					error: null,
				});
			}
		} catch (err) {
			console.error("Failed to init chat sessions:", err);
			set({ initialized: true });
		}
	},

	switchSession: async (sessionId: string) => {
		const state = get();
		if (sessionId === state.activeSessionId) return;

		await persistActiveSession(state);

		try {
			const messages = await chatStorage.loadSessionMessages(sessionId);
			set({ activeSessionId: sessionId, messages, loading: false, error: null });
		} catch (err) {
			console.error("Failed to switch session:", err);
		}
	},

	createSession: async () => {
		const state = get();
		if (!state.projectId) return "";

		await persistActiveSession(state);

		const now = Date.now();
		const session: ChatSessionMeta = {
			id: nanoid(),
			projectId: state.projectId,
			title: "New chat",
			messageCount: 0,
			lastMessageAt: now,
			createdAt: now,
		};
		await chatStorage.saveSession(session, []);
		set((s) => ({
			sessions: [session, ...s.sessions],
			activeSessionId: session.id,
			messages: [],
			loading: false,
			error: null,
		}));
		return session.id;
	},

	deleteSession: async (sessionId: string) => {
		const state = get();
		await chatStorage.deleteSession(sessionId);

		const remaining = state.sessions.filter((s) => s.id !== sessionId);

		if (sessionId === state.activeSessionId) {
			if (remaining.length > 0) {
				const messages = await chatStorage.loadSessionMessages(remaining[0].id);
				set({
					sessions: remaining,
					activeSessionId: remaining[0].id,
					messages,
					loading: false,
					error: null,
				});
			} else {
				const now = Date.now();
				const fresh: ChatSessionMeta = {
					id: nanoid(),
					projectId: state.projectId!,
					title: "New chat",
					messageCount: 0,
					lastMessageAt: now,
					createdAt: now,
				};
				await chatStorage.saveSession(fresh, []);
				set({
					sessions: [fresh],
					activeSessionId: fresh.id,
					messages: [],
					loading: false,
					error: null,
				});
			}
		} else {
			set({ sessions: remaining });
		}
	},

	renameSession: async (sessionId: string, title: string) => {
		set((s) => ({
			sessions: s.sessions.map((sess) =>
				sess.id === sessionId ? { ...sess, title } : sess,
			),
		}));
		const session = get().sessions.find((s) => s.id === sessionId);
		if (session) {
			await chatStorage.updateSessionMeta({ ...session, title });
		}
	},

	addMessage: (message) => {
		const state = get();
		if (!state.activeSessionId) return;

		const full: ChatMessage = {
			...message,
			id: nanoid(),
			timestamp: Date.now(),
			sessionId: state.activeSessionId,
		};
		set((s) => ({ messages: [...s.messages, full] }));
		scheduleSave(get);
	},

	sendMessage: (content) => {
		const state = get();
		if (!state.activeSessionId) return;

		const userMessage: ChatMessage = {
			id: nanoid(),
			role: "user",
			content,
			timestamp: Date.now(),
			sessionId: state.activeSessionId,
		};

		const isFirstMessage = state.messages.length === 0;
		const title = isFirstMessage ? generateTitle(content) : undefined;

		set((s) => ({
			messages: [...s.messages, userMessage],
			loading: true,
			error: null,
			...(isFirstMessage && title
				? {
						sessions: s.sessions.map((sess) =>
							sess.id === s.activeSessionId
								? { ...sess, title, messageCount: 1, lastMessageAt: Date.now() }
								: sess,
						),
					}
				: {}),
		}));

		scheduleSave(get);
	},

	setLoading: (loading) => set({ loading }),
	setError: (error) => set({ error, loading: false }),
	clearMessages: () => set({ messages: [], error: null, loading: false }),
}));
