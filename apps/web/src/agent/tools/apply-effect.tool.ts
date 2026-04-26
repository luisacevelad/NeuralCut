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
				effectId: string;
				elementId: string;
				appliedParams: Record<string, number | string | boolean>;
		  }
		| { error: string }
	> => {
		const trackId = args.trackId;
		const elementId = args.elementId;
		const effectType = args.effectType;
		const params = args.params as
			| Record<string, number | string | boolean>
			| undefined;

		if (typeof trackId !== "string" || !trackId.trim()) {
			return { error: "Invalid track id" };
		}

		if (typeof elementId !== "string" || !elementId.trim()) {
			return { error: "Invalid element id" };
		}

		if (typeof effectType !== "string" || !effectType.trim()) {
			return { error: "Invalid effect type" };
		}

		if (params !== undefined && typeof params !== "object") {
			return { error: "Invalid effect parameters" };
		}

		return EditorContextAdapter.addEffect({
			trackId,
			elementId,
			effectType,
			params,
		});
	},
};

toolRegistry.register(applyEffectSchema.name, applyEffectTool);
