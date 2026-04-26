import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { applyEffectSchema } from "@/agent/tools/schemas";
import { EditorContextAdapter } from "@/agent/context";

const applyEffectTool: ToolDefinition = {
	...applyEffectSchema,
	execute: async (
		args: Record<string, unknown>,
		_context: AgentContext,
	): Promise<
		| {
				elementId: string;
				trackId: string;
				appliedParams: Record<string, number | string | boolean>;
		  }
		| { error: string }
	> => {
		const effectType = args.effectType;
		const start = args.start;
		const end = args.end;
		const params = args.params as
			| Record<string, number | string | boolean>
			| undefined;

		if (typeof effectType !== "string" || !effectType.trim()) {
			return { error: "Invalid effect type" };
		}

		if (typeof start !== "number" || !Number.isFinite(start) || start < 0) {
			return { error: "Invalid start time" };
		}

		if (typeof end !== "number" || !Number.isFinite(end) || end <= start) {
			return { error: "Invalid end time" };
		}

		if (params !== undefined && typeof params !== "object") {
			return { error: "Invalid effect parameters" };
		}

		return EditorContextAdapter.addEffectElement({
			effectType,
			start,
			end,
			params,
		});
	},
};

toolRegistry.register(applyEffectSchema.name, applyEffectTool);
