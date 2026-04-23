import { beforeEach, describe, expect, test } from "bun:test";
import { useAgentStore } from "@/stores/agent-store";
import type { AgentContext } from "@/agent/types";

const MOCK_CONTEXT: AgentContext = {
	projectId: "proj-1",
	activeSceneId: "scene-A",
	mediaAssets: [{ id: "m1", name: "clip.mp4", type: "video", duration: 60 }],
	playbackTimeMs: 3000,
};

describe("agentStore", () => {
	beforeEach(() => {
		useAgentStore.getState().reset();
	});

	test("initial state is idle with no active tool and default context", () => {
		const state = useAgentStore.getState();
		expect(state.status).toBe("idle");
		expect(state.activeTool).toBeNull();
		expect(state.context.projectId).toBeNull();
		expect(state.context.mediaAssets).toEqual([]);
	});

	test("setStatus transitions through execution states", () => {
		const { setStatus } = useAgentStore.getState();

		setStatus("sending");
		expect(useAgentStore.getState().status).toBe("sending");

		setStatus("processing");
		expect(useAgentStore.getState().status).toBe("processing");

		setStatus("idle");
		expect(useAgentStore.getState().status).toBe("idle");

		setStatus("error");
		expect(useAgentStore.getState().status).toBe("error");
	});

	test("setActiveTool tracks current tool execution", () => {
		const { setActiveTool } = useAgentStore.getState();

		setActiveTool("echo_context");
		expect(useAgentStore.getState().activeTool).toBe("echo_context");

		setActiveTool(null);
		expect(useAgentStore.getState().activeTool).toBeNull();
	});

	test("setContext stores the agent context snapshot", () => {
		useAgentStore.getState().setContext(MOCK_CONTEXT);

		const { context } = useAgentStore.getState();
		expect(context.projectId).toBe("proj-1");
		expect(context.activeSceneId).toBe("scene-A");
		expect(context.mediaAssets).toHaveLength(1);
		expect(context.playbackTimeMs).toBe(3000);
	});

	test("setContext is JSON-serializable", () => {
		useAgentStore.getState().setContext(MOCK_CONTEXT);
		const { context } = useAgentStore.getState();

		const json = JSON.stringify(context);
		const parsed = JSON.parse(json);
		expect(parsed).toEqual(context);
	});

	test("reset returns to initial state from any state", () => {
		const store = useAgentStore.getState();
		store.setStatus("processing");
		store.setActiveTool("echo_context");
		store.setContext(MOCK_CONTEXT);

		useAgentStore.getState().reset();

		const state = useAgentStore.getState();
		expect(state.status).toBe("idle");
		expect(state.activeTool).toBeNull();
		expect(state.context.projectId).toBeNull();
		expect(state.context.mediaAssets).toEqual([]);
	});
});
