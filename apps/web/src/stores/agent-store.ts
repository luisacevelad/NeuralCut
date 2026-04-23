import { create } from "zustand";
import type { AgentContext, ExecutionState } from "@/agent/types";

const DEFAULT_CONTEXT: AgentContext = {
	projectId: null,
	activeSceneId: null,
	mediaAssets: [],
	playbackTimeMs: 0,
};

interface AgentState {
	status: ExecutionState;
	activeTool: string | null;
	context: AgentContext;
	setStatus: (status: ExecutionState) => void;
	setActiveTool: (tool: string | null) => void;
	setContext: (context: AgentContext) => void;
	reset: () => void;
}

export const useAgentStore = create<AgentState>()((set) => ({
	status: "idle",
	activeTool: null,
	context: DEFAULT_CONTEXT,
	setStatus: (status) => set({ status }),
	setActiveTool: (tool) => set({ activeTool: tool }),
	setContext: (context) => set({ context }),
	reset: () =>
		set({ status: "idle", activeTool: null, context: DEFAULT_CONTEXT }),
}));
