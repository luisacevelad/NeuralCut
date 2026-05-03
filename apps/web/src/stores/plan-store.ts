import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
	AgentQuestion,
	Plan,
	PlanStepStatus,
	PlanStatus,
} from "@/agent/types";

/** Derive current pending question and IDs from the queue. */
function deriveFromQueue(questions: AgentQuestion[]) {
	const unanswered = questions.find((q) => !q.answer) ?? null;
	return {
		pendingQuestions: questions,
		currentPendingQuestion: unanswered,
		pendingQuestionIds: questions.filter((q) => !q.answer).map((q) => q.id),
		pendingQuestion: unanswered,
	};
}

interface PlanState {
	plan: Plan | null;
	/** @deprecated Use currentPendingQuestion instead. Kept for backward compat. */
	pendingQuestion: AgentQuestion | null;
	/** Queue of questions for multi-question ask_user support. */
	pendingQuestions: AgentQuestion[];
	/** First unanswered question, or null. Updated automatically. */
	currentPendingQuestion: AgentQuestion | null;
	/** IDs of unanswered questions. Updated automatically. */
	pendingQuestionIds: string[];
	modeTransitionPending: boolean;

	setPlan: (plan: Plan) => void;
	updatePlanStatus: (status: PlanStatus) => void;
	updateStepStatus: (
		stepId: string,
		status: PlanStepStatus,
		result?: string,
	) => void;
	clearPlan: () => void;

	/** @deprecated Use addPendingQuestions for multi-question support. */
	setPendingQuestion: (question: AgentQuestion | null) => void;
	/** @deprecated Use answerPendingQuestion for queue-based answering. */
	answerQuestion: (answer: string) => void;

	/** Enqueue one or more questions. */
	addPendingQuestions: (questions: AgentQuestion[]) => void;
	/** Answer a specific question by ID. */
	answerPendingQuestion: (questionId: string, answer: string) => void;

	setModeTransitionPending: (pending: boolean) => void;
}

export const usePlanStore = create<PlanState>()((set, get) => ({
	plan: null,
	pendingQuestion: null,
	pendingQuestions: [],
	currentPendingQuestion: null,
	pendingQuestionIds: [],
	modeTransitionPending: false,

	setPlan: (plan) => set({ plan }),

	updatePlanStatus: (status) => {
		const current = get().plan;
		if (!current) return;
		set({ plan: { ...current, status } });
	},

	updateStepStatus: (stepId, status, result) => {
		const current = get().plan;
		if (!current) return;
		set({
			plan: {
				...current,
				steps: current.steps.map((s) =>
					s.id === stepId
						? { ...s, status, ...(result !== undefined && { result }) }
						: s,
				),
			},
		});
	},

	clearPlan: () =>
		set({
			plan: null,
			pendingQuestion: null,
			pendingQuestions: [],
			currentPendingQuestion: null,
			pendingQuestionIds: [],
		}),

	setPendingQuestion: (question) => {
		if (question) {
			set(deriveFromQueue([question]));
		} else {
			set({
				pendingQuestion: null,
				pendingQuestions: [],
				currentPendingQuestion: null,
				pendingQuestionIds: [],
			});
		}
	},

	answerQuestion: (answer) => {
		const current = get().pendingQuestion;
		if (!current) return;
		const updated = get().pendingQuestions.map((q) =>
			q.id === current.id ? { ...q, answer } : q,
		);
		set(deriveFromQueue(updated));
	},

	addPendingQuestions: (questions) => {
		const merged = [...get().pendingQuestions, ...questions];
		set(deriveFromQueue(merged));
	},

	answerPendingQuestion: (questionId, answer) => {
		const updated = get().pendingQuestions.map((q) =>
			q.id === questionId ? { ...q, answer } : q,
		);
		set(deriveFromQueue(updated));
	},

	setModeTransitionPending: (pending) =>
		set({ modeTransitionPending: pending }),
}));

export function createPlanFromSteps(
	summary: string,
	steps: Array<{ description: string; tools: string[] }>,
	questions?: string[],
): Plan {
	return {
		id: nanoid(),
		summary,
		steps: steps.map((s) => ({
			id: nanoid(),
			description: s.description,
			tools: s.tools,
			status: "pending" as PlanStepStatus,
		})),
		questions,
		status: "awaiting_approval" as PlanStatus,
		createdAt: Date.now(),
	};
}
