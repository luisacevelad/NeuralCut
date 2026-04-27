import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { updateEffectSchema } from "@/agent/tools/schemas";
import { EditorContextAdapter } from "@/agent/context";

const updateEffectTool: ToolDefinition = {
	...updateEffectSchema,
	execute: async (
		args: Record<string, unknown>,
		_context: AgentContext,
	): Promise<
		| {
				success: boolean;
				elementId: string;
				appliedParams: Record<string, number | string | boolean>;
		  }
		| { error: string }
	> => {
		const elementId = args.elementId;
		const params = args.params as
			| Record<string, number | string | boolean>
			| undefined;

		if (typeof elementId !== "string" || !elementId.trim()) {
			return { error: "Invalid element id" };
		}

		if (!params || typeof params !== "object" || Object.keys(params).length === 0) {
			return { error: "params is required and must be a non-empty object" };
		}

		return EditorContextAdapter.updateEffectElement({
			elementId,
			params,
		});
	},
};

toolRegistry.register(updateEffectSchema.name, updateEffectTool);
