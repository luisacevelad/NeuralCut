import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { askUserSchema } from "@/agent/tools/schemas";
import { usePlanStore } from "@/stores/plan-store";
import { nanoid } from "nanoid";

type QuestionInput = {
	question: string;
	options?: Array<{ label: string; description?: string }>;
};

/**
 * Checks if all questions in the queue have been answered.
 * Returns the answers array if complete, or null if still pending.
 */
function getCompletedAnswers(
	questionIds: string[],
): Array<{ questionId: string; question: string; answer: string }> | null {
	const store = usePlanStore.getState();
	const answers: Array<{ questionId: string; question: string; answer: string }> =
		[];

	for (const id of questionIds) {
		const q = store.pendingQuestions.find((pq) => pq.id === id);
		if (!q?.answer) return null;
		answers.push({ questionId: id, question: q.question, answer: q.answer });
	}

	return answers;
}

/**
 * Waits for all specified question IDs to be answered, then resolves.
 * Cleans up the store subscription and clears the queue on completion.
 */
function waitForAnswers(
	questionIds: string[],
): Promise<Array<{ questionId: string; question: string; answer: string }>> {
	return new Promise((resolve) => {
		const unsubscribe = usePlanStore.subscribe(() => {
			const completed = getCompletedAnswers(questionIds);
			if (completed) {
				unsubscribe();
				usePlanStore.getState().clearPlan();
				resolve(completed);
			}
		});
	});
}

const askUserTool: ToolDefinition = {
	...askUserSchema,
	execute: async (
		args: Record<string, unknown>,
		_context: AgentContext,
	): Promise<
		| { questionId: string; answer: string }
		| { questionIds: string[]; answers: Array<{ questionId: string; question: string; answer: string }> }
		| { error: string }
	> => {
		const { question, options, questions } = args as {
			question?: string;
			options?: Array<{ label: string; description?: string }>;
			questions?: QuestionInput[];
		};

		// Multi-question mode
		if (questions && Array.isArray(questions) && questions.length > 0) {
			const questionIds: string[] = [];

			const agentQuestions = questions.map((q) => {
				const id = nanoid();
				questionIds.push(id);
				return { id, question: q.question, options: q.options };
			});

			usePlanStore.getState().addPendingQuestions(agentQuestions);

			const answers = await waitForAnswers(questionIds);
			return { questionIds, answers };
		}

		// Single-question mode (backward compat)
		if (!question || typeof question !== "string") {
			return {
				error:
					"Provide 'question' (string) or 'questions' (array). At least one is required.",
			};
		}

		if (question.trim().length === 0) {
			return { error: "question is required and must be a non-empty string" };
		}

		const questionId = nanoid();
		usePlanStore.getState().addPendingQuestions([
			{
				id: questionId,
				question,
				options:
					options && Array.isArray(options) ? options : undefined,
			},
		]);

		const answers = await waitForAnswers([questionId]);
		return { questionId, answer: answers[0].answer };
	},
};

toolRegistry.register(askUserSchema.name, askUserTool);
