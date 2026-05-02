import { create } from "zustand";
import type {
	AgentContext,
	AgentMode,
	ExecutionState,
	ToolCall,
} from "@/agent/types";

export type PermissionMode = "ask" | "skip";

export interface PendingToolApproval {
	toolCall: ToolCall;
	resolve: (approved: boolean) => void;
}

export interface TokenUsage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
	lastPromptTokens: number;
	cachedTokens: number;
}

export interface PendingModeTransition {
	targetMode: AgentMode;
	resolve: (approved: boolean) => void;
}

const DEFAULT_CONTEXT: AgentContext = {
	projectId: null,
	activeSceneId: null,
	fps: null,
	duration: null,
	resolution: null,
	aspectRatio: null,
	projectName: null,
	mediaAssets: [],
	playbackTimeMs: 0,
};

interface AgentState {
	status: ExecutionState;
	activeTool: string | null;
	context: AgentContext;
	permissionMode: PermissionMode;
	pendingApproval: PendingToolApproval | null;
	mode: AgentMode;
	pendingModeTransition: PendingModeTransition | null;
	tokenUsage: TokenUsage;
	abortController: AbortController | null;
	setStatus: (status: ExecutionState) => void;
	setActiveTool: (tool: string | null) => void;
	setContext: (context: AgentContext) => void;
	setPermissionMode: (mode: PermissionMode) => void;
	setPendingApproval: (pending: PendingToolApproval | null) => void;
	setMode: (mode: AgentMode) => void;
	setPendingModeTransition: (transition: PendingModeTransition | null) => void;
	addTokenUsage: (usage: TokenUsage) => void;
	startRun: () => AbortSignal;
	cancelRun: () => void;
	reset: () => void;
}

export const useAgentStore = create<AgentState>()((set, get) => ({
	status: "idle",
	activeTool: null,
	context: DEFAULT_CONTEXT,
	permissionMode: "skip",
	pendingApproval: null,
	mode: "execute",
	pendingModeTransition: null,
	tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, lastPromptTokens: 0, cachedTokens: 0 },
	abortController: null,
	setStatus: (status) => set({ status }),
	setActiveTool: (tool) => set({ activeTool: tool }),
	setContext: (context) => set({ context }),
	setPermissionMode: (mode) => set({ permissionMode: mode }),
	setPendingApproval: (pending) => set({ pendingApproval: pending }),
	setMode: (mode) => set({ mode }),
	setPendingModeTransition: (transition) =>
		set({ pendingModeTransition: transition }),
	addTokenUsage: (usage) => {
		const current = get().tokenUsage;
		set({
			tokenUsage: {
				promptTokens: current.promptTokens + usage.promptTokens,
				completionTokens: current.completionTokens + usage.completionTokens,
				totalTokens: current.totalTokens + usage.totalTokens,
				lastPromptTokens: usage.promptTokens,
				cachedTokens: current.cachedTokens + (usage.cachedTokens ?? 0),
			},
		});
	},
	startRun: () => {
		const controller = new AbortController();
		set({ abortController: controller });
		return controller.signal;
	},
	cancelRun: () => {
		const current = get();
		current.abortController?.abort();
		current.pendingApproval?.resolve(false);
		current.pendingModeTransition?.resolve(false);
		set({
			status: "idle",
			activeTool: null,
			pendingApproval: null,
			pendingModeTransition: null,
			abortController: null,
		});
	},
	reset: () => {
		const current = get();
		current.abortController?.abort();
		set({
			status: "idle",
			activeTool: null,
			context: DEFAULT_CONTEXT,
			pendingApproval: null,
			mode: "execute",
			pendingModeTransition: null,
			tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, lastPromptTokens: 0, cachedTokens: 0 },
			abortController: null,
		});
	},
}));
