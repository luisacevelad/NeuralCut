import { afterEach, describe, expect, test } from "bun:test";
import { usePlanStore } from "@/stores/plan-store";

describe("plan-store", () => {
	afterEach(() => {
		usePlanStore.getState().clearPlan();
	});

	test("addPendingQuestions enqueues multiple questions", () => {
		const store = usePlanStore.getState();

		store.addPendingQuestions([
			{ id: "q1", question: "Style?" },
			{ id: "q2", question: "Tone?" },
			{ id: "q3", question: "Pace?" },
		]);

		const state = usePlanStore.getState();
		expect(state.pendingQuestions).toHaveLength(3);
		expect(state.pendingQuestions[0].id).toBe("q1");
		expect(state.pendingQuestions[1].id).toBe("q2");
		expect(state.pendingQuestions[2].id).toBe("q3");
	});

	test("currentPendingQuestion returns first unanswered", () => {
		const store = usePlanStore.getState();

		store.addPendingQuestions([
			{ id: "q1", question: "Style?", options: [{ label: "Bold" }, { label: "Minimal" }] },
			{ id: "q2", question: "Tone?" },
		]);

		const current = usePlanStore.getState().currentPendingQuestion;
		expect(current).not.toBeNull();
		expect(current!.id).toBe("q1");
		expect(current!.question).toBe("Style?");
		expect(current!.options).toHaveLength(2);
	});

	test("answerPendingQuestion marks specific question answered", () => {
		const store = usePlanStore.getState();

		store.addPendingQuestions([
			{ id: "q1", question: "Style?" },
			{ id: "q2", question: "Tone?" },
			{ id: "q3", question: "Pace?" },
		]);

		store.answerPendingQuestion("q1", "Bold");

		const state = usePlanStore.getState();
		expect(state.pendingQuestions[0].answer).toBe("Bold");
		expect(state.pendingQuestions[1].answer).toBeUndefined();
		expect(state.pendingQuestions[2].answer).toBeUndefined();
	});

	test("currentPendingQuestion advances after answer", () => {
		const store = usePlanStore.getState();

		store.addPendingQuestions([
			{ id: "q1", question: "Style?" },
			{ id: "q2", question: "Tone?" },
		]);

		// Before answering
		expect(usePlanStore.getState().currentPendingQuestion!.id).toBe("q1");

		// Answer first
		store.answerPendingQuestion("q1", "Bold");

		// Now current should be q2
		expect(usePlanStore.getState().currentPendingQuestion!.id).toBe("q2");
	});

	test("currentPendingQuestion returns null when all answered", () => {
		const store = usePlanStore.getState();

		store.addPendingQuestions([
			{ id: "q1", question: "Style?" },
			{ id: "q2", question: "Tone?" },
		]);

		store.answerPendingQuestion("q1", "Bold");
		store.answerPendingQuestion("q2", "Casual");

		expect(usePlanStore.getState().currentPendingQuestion).toBeNull();
	});

	test("clearPlan resets pendingQuestions to empty array", () => {
		const store = usePlanStore.getState();
		store.addPendingQuestions([{ id: "q1", question: "Style?" }]);
		expect(usePlanStore.getState().pendingQuestions).toHaveLength(1);

		store.clearPlan();
		expect(usePlanStore.getState().pendingQuestions).toHaveLength(0);
	});

	test("pendingQuestionIds returns IDs of unanswered questions", () => {
		const store = usePlanStore.getState();

		store.addPendingQuestions([
			{ id: "q1", question: "Style?" },
			{ id: "q2", question: "Tone?" },
			{ id: "q3", question: "Pace?" },
		]);

		store.answerPendingQuestion("q2", "Casual");

		const ids = usePlanStore.getState().pendingQuestionIds;
		expect(ids).toEqual(["q1", "q3"]);
	});

	test("single-question backward compat: setPendingQuestion + answerQuestion still works", () => {
		const store = usePlanStore.getState();

		// Legacy single-question API
		store.setPendingQuestion({
			id: "legacy-1",
			question: "Legacy question?",
		});

		// Should appear in the queue
		expect(usePlanStore.getState().pendingQuestions).toHaveLength(1);
		expect(usePlanStore.getState().currentPendingQuestion!.id).toBe("legacy-1");

		// Legacy answer
		store.answerQuestion("Legacy answer");

		expect(usePlanStore.getState().pendingQuestions[0].answer).toBe("Legacy answer");
	});
});
