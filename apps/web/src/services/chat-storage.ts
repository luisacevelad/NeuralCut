import { IndexedDBAdapter } from "@/services/storage/indexeddb-adapter";
import type { ChatMessage, ChatSessionMeta } from "@/agent/types";

const SESSIONS_DB = "video-editor-chat-sessions";
const MESSAGES_DB = "video-editor-chat-messages";
const DB_VERSION = 1;

interface StoredMessages {
	id: string;
	sessionId: string;
	messages: ChatMessage[];
}

class ChatStorage {
	private sessionsAdapter = new IndexedDBAdapter<ChatSessionMeta>(
		SESSIONS_DB,
		"sessions",
		DB_VERSION,
	);

	private messagesAdapter = new IndexedDBAdapter<StoredMessages>(
		MESSAGES_DB,
		"messages",
		DB_VERSION,
	);

	async saveSession(meta: ChatSessionMeta, messages: ChatMessage[]): Promise<void> {
		await Promise.all([
			this.sessionsAdapter.set(meta.id, { ...meta }),
			this.messagesAdapter.set(meta.id, { id: meta.id, sessionId: meta.id, messages }),
		]);
	}

	async updateSessionMeta(meta: ChatSessionMeta): Promise<void> {
		await this.sessionsAdapter.set(meta.id, { ...meta });
	}

	async loadSessionList(projectId: string): Promise<ChatSessionMeta[]> {
		const all = await this.sessionsAdapter.getAll();
		return all
			.filter((s) => s.projectId === projectId)
			.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
	}

	async loadSessionMessages(sessionId: string): Promise<ChatMessage[]> {
		const data = await this.messagesAdapter.get(sessionId);
		return data?.messages ?? [];
	}

	async deleteSession(sessionId: string): Promise<void> {
		await Promise.all([
			this.sessionsAdapter.remove(sessionId),
			this.messagesAdapter.remove(sessionId),
		]);
	}

	async deleteProjectSessions(projectId: string): Promise<void> {
		const sessions = await this.loadSessionList(projectId);
		await Promise.all(
			sessions.map((s) =>
				Promise.all([
					this.sessionsAdapter.remove(s.id),
					this.messagesAdapter.remove(s.id),
				]),
			),
		);
	}
}

export const chatStorage = new ChatStorage();
