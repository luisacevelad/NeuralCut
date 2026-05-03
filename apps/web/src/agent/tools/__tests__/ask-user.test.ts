import { describe, expect, test } from "bun:test";
import { usePlanStore } from "@/stores/plan-store";

const MOCK_CONTEXT = {
	projectId: null,
	activeSceneId: null,
	fps: null as number | null,
	duration: null as number | null,
	resolution: null as { width: number; height: number } | null,
	aspectRatio: null as string | null,
	projectName: null as string | null,
	mediaAssets: [],
	playbackTimeMs: 0,
};

// We test the ask_user tool logic by importing it after setup.
// The tool auto-registers, so we import the registry to get it.
import { toolRegistry } from "@/agent/tools/registry";

// Ensure the tool is loaded (side-effect import registers it)
import "@/agent/tools/ask-user.tool";

describe("ask_user tool", () => {
	test("single question works (backward compat)", async () => {
		usePlanStore.getState().clearPlan();
		const tool = toolRegistry.get("ask_user");

		// Start the tool call — it blocks until answered
		const resultPromise = tool.execute(
			{ question: "What style do you want?" },
			MOCK_CONTEXT as any,
		);

		// Give it a tick to set up the subscription
		await new Promise((r) => setTimeout(r, 10));

		// The question should be in the store
		const state = usePlanStore.getState();
		expect(state.currentPendingQuestion).not.toBeNull();
		expect(state.currentPendingQuestion!.question).toBe(
			"What style do you want?",
		);

		// Answer it
		const qId = state.currentPendingQuestion!.id;
		state.answerPendingQuestion(qId, "Bold");

		// The tool should resolve
		const result = (await resultPromise) as any;
		expect(result.questionId).toBeTruthy();
		expect(result.answer).toBe("Bold");

		usePlanStore.getState().clearPlan();
	});

	test("single question with options works", async () => {
		usePlanStore.getState().clearPlan();
		const tool = toolRegistry.get("ask_user");

		const resultPromise = tool.execute(
			{
				question: "Pick one",
				options: [
					{ label: "Option A" },
					{ label: "Option B", description: "The second option" },
				],
			},
			MOCK_CONTEXT as any,
		);

		await new Promise((r) => setTimeout(r, 10));

		const state = usePlanStore.getState();
		expect(state.currentPendingQuestion!.options).toHaveLength(2);
		expect(state.currentPendingQuestion!.options![0].label).toBe("Option A");

		const qId = state.currentPendingQuestion!.id;
		state.answerPendingQuestion(qId, "Option A");

		const result = (await resultPromise) as any;
		expect(result.answer).toBe("Option A");

		usePlanStore.getState().clearPlan();
	});

	test("multi-question enqueues all and resolves when all answered", async () => {
		usePlanStore.getState().clearPlan();
		const tool = toolRegistry.get("ask_user");

		const resultPromise = tool.execute(
			{
				questions: [
					{ question: "Style?", options: [{ label: "Bold" }, { label: "Minimal" }] },
					{ question: "Tone?" },
					{ question: "Pace?" },
				],
			},
			MOCK_CONTEXT as any,
		);

		await new Promise((r) => setTimeout(r, 10));

		// All three questions should be in the queue
		const state1 = usePlanStore.getState();
		expect(state1.pendingQuestions).toHaveLength(3);
		expect(state1.currentPendingQuestion!.question).toBe("Style?");

		// Answer first
		state1.answerPendingQuestion(state1.currentPendingQuestion!.id, "Bold");

		// Should advance to second
		const state2 = usePlanStore.getState();
		expect(state2.currentPendingQuestion!.question).toBe("Tone?");

		// Answer second
		state2.answerPendingQuestion(state2.currentPendingQuestion!.id, "Casual");

		// Should advance to third
		const state3 = usePlanStore.getState();
		expect(state3.currentPendingQuestion!.question).toBe("Pace?");

		// Answer third
		state3.answerPendingQuestion(state3.currentPendingQuestion!.id, "Fast");

		// Tool should resolve with all answers
		const result = (await resultPromise) as any;
		expect(result.answers).toHaveLength(3);
		expect(result.answers[0].answer).toBe("Bold");
		expect(result.answers[1].answer).toBe("Casual");
		expect(result.answers[2].answer).toBe("Fast");

		usePlanStore.getState().clearPlan();
	});

	test("returns error when neither question nor questions provided", async () => {
		const tool = toolRegistry.get("ask_user");
		const result = (await tool.execute({}, MOCK_CONTEXT as any)) as any;
		expect(result.error).toContain("question");
	});

	test("returns error when question is empty string", async () => {
		const tool = toolRegistry.get("ask_user");
		const result = (await tool.execute(
			{ question: "" },
			MOCK_CONTEXT as any,
		)) as any;
		expect(result.error).toContain("required");
	});
});
