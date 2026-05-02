import { EditorContextAdapter } from "@/agent/context";
import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { resolveElement } from "@/agent/ref-resolver";
import { splitSchema } from "@/agent/tools/schemas";

export type SplitArgs = {
	times: number[];
	target?: string;
};

export type SplitResult = {
	success: boolean;
	affectedElements: string[];
};

const splitTool: ToolDefinition = {
	...splitSchema,
	execute: async (
		args: Record<string, unknown>,
		context: AgentContext,
	): Promise<SplitResult | { error: string }> => {
		const times = args.times;

		if (!isValidTimes(times)) {
			return { error: "Invalid split times" };
		}

		const elementId = resolveTargetElementId(args.target, context);
		if ("error" in elementId) return elementId;

		return EditorContextAdapter.splitTimeline({
			times,
			elementId: elementId.value,
		});
	},
};

function resolveTargetElementId(
	target: unknown,
	context: AgentContext,
): { value: string | undefined } | { error: string } {
	if (target === undefined || target === null) return { value: undefined };
	if (typeof target !== "string" || target.trim().length === 0) {
		return { value: undefined };
	}

	const result = resolveElement(target, context);
	if ("error" in result) return result;
	return { value: result.elementId };
}

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
