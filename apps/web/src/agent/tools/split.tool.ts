import { EditorContextAdapter } from "@/agent/context";
import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";

export type SplitArgs = {
	times: number[];
};

export type SplitResult = {
	success: boolean;
	affectedElements: string[];
};

const splitTool: ToolDefinition = {
	name: "split",
	description:
		"Splits timeline elements at one or more requested times without deleting, trimming, or moving content. Use one time for a single cut, or multiple times to isolate ranges before separate edit/delete operations.",
	parameters: [{ key: "times", type: "number[]", required: true }],
	execute: async (
		args: Record<string, unknown>,
		_context: AgentContext,
	): Promise<SplitResult | { error: string }> => {
		const times = args.times;

		if (!isValidTimes(times)) {
			return { error: "Invalid split times" };
		}

		return EditorContextAdapter.splitTimeline({ times });
	},
};

function isValidTimes(times: unknown): times is number[] {
	return (
		Array.isArray(times) &&
		times.length > 0 &&
		times.every(
			(time) => typeof time === "number" && Number.isFinite(time) && time >= 0,
		)
	);
}

toolRegistry.register("split", splitTool);
