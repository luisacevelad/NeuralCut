import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { updateEffectSchema } from "@/agent/tools/schemas";
import { EditorContextAdapter } from "@/agent/context";
import { resolveTargetsToElementIds } from "@/agent/tools/resolve-element-ids";

const updateEffectTool: ToolDefinition = {
	...updateEffectSchema,
	execute: async (
		args: Record<string, unknown>,
		context: AgentContext,
	):
		| Promise<
				| {
						success: boolean;
						updated: Array<{
							elementId: string;
							appliedParams: Record<string, number | string | boolean>;
						}>;
						skipped: string[];
				  }
				| { error: string }
		  >
		| { error: string } => {
		const raw = args.targets ?? args.elementIds ?? args.elementId;
		const params = args.params as
			| Record<string, number | string | boolean>
			| undefined;

		if (!params || typeof params !== "object" || Object.keys(params).length === 0) {
			return { error: "params is required and must be a non-empty object" };
		}

		const resolved = resolveTargetsToElementIds(raw, context);
		if ("error" in resolved) return resolved;

		const updated: Array<{
			elementId: string;
			appliedParams: Record<string, number | string | boolean>;
		}> = [];
		const skipped: string[] = [];

		for (const elementId of resolved.elementIds) {
			const result = EditorContextAdapter.updateEffectElement({
				elementId,
				params,
			});
			if ("error" in result) {
				skipped.push(elementId);
			} else {
				updated.push({
					elementId,
					appliedParams: result.appliedParams,
				});
			}
		}

		if (updated.length === 0) {
			return { error: "All targets failed to update" };
		}

		return { success: true, updated, skipped };
	},
};

toolRegistry.register(updateEffectSchema.name, updateEffectTool);
