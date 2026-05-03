import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { getElementSchema } from "@/agent/tools/schemas";
import { EditorContextAdapter } from "@/agent/context";
import { resolveElement } from "@/agent/ref-resolver";

const getElementTool: ToolDefinition = {
	...getElementSchema,
	execute: async (
		args: Record<string, unknown>,
		context: AgentContext,
	): Promise<Record<string, unknown> | { error: string }> => {
		const target = args.target ?? args.elementId;
		if (typeof target !== "string" || !target.trim()) {
			return { error: "Pass target (element ref, displayName, or elementId)." };
		}

		const resolved = resolveElement(target, context);
		if ("error" in resolved) return resolved;

		return EditorContextAdapter.getElement({ elementId: resolved.elementId });
	},
};

toolRegistry.register(getElementSchema.name, getElementTool);
