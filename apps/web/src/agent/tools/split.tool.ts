import { EditorContextAdapter } from "@/agent/context";
import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { splitSchema } from "@/agent/tools/schemas";

export type SplitArgs = {
	times: number[];
};

export type SplitResult = {
	success: boolean;
	affectedElements: string[];
};

const splitTool: ToolDefinition = {
	...splitSchema,
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

toolRegistry.register(splitSchema.name, splitTool);
