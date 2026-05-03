import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { updateClipSchema } from "@/agent/tools/schemas";
import { EditorContextAdapter } from "@/agent/context";
import { resolveTargetsToElementIds } from "@/agent/tools/resolve-element-ids";
import type {
	ReasonCode,
	ToolResultEntry,
} from "@/agent/tools/utils/tool-results";

function classifyClipError(error: string): ReasonCode {
	if (error.includes("not found") || error.includes("not Found"))
		return "TARGET_NOT_FOUND";
	if (error.includes("does not support")) return "UNSUPPORTED_ELEMENT_TYPE";
	return "INTERNAL_ERROR";
}

const updateClipTool: ToolDefinition = {
	...updateClipSchema,
	execute: async (
		args: Record<string, unknown>,
		context: AgentContext,
	):
		| Promise<
				| {
						success: boolean;
						updated: Array<{
							elementId: string;
							applied: Record<string, unknown>;
							state: Record<string, unknown>;
						}>;
						skipped: string[];
						results: ToolResultEntry[];
				  }
				| { error: string; results?: ToolResultEntry[] }
		  >
		| { error: string; results?: ToolResultEntry[] } => {
		const raw = args.targets ?? args.target ?? args.elementIds ?? args.elementId;
		const name = args.name as string | undefined;
		const mask = args.mask as
			| {
					action: "add" | "update" | "remove";
					maskType?: string;
					params?: Record<string, number | string | boolean>;
			  }
			| undefined;
		const trimStart = args.trimStart as number | undefined;
		const trimEnd = args.trimEnd as number | undefined;
		const opacity = args.opacity as number | undefined;
		const positionX = args.positionX as number | undefined;
		const positionY = args.positionY as number | undefined;
		const rotation = args.rotation as number | undefined;
		const scaleX = args.scaleX as number | undefined;
		const scaleY = args.scaleY as number | undefined;
		const blendMode = args.blendMode as string | undefined;
		const hidden = args.hidden as boolean | undefined;
		const volume = args.volume as number | undefined;
		const muted = args.muted as boolean | undefined;

		const hasUpdate =
			name !== undefined ||
			mask !== undefined ||
			trimStart !== undefined ||
			trimEnd !== undefined ||
			opacity !== undefined ||
			positionX !== undefined ||
			positionY !== undefined ||
			rotation !== undefined ||
			scaleX !== undefined ||
			scaleY !== undefined ||
			blendMode !== undefined ||
			hidden !== undefined ||
			volume !== undefined ||
			muted !== undefined;

		if (!hasUpdate) {
			return {
				error: "No properties to update. Provide at least one property.",
			};
		}

		if (
			mask !== undefined &&
			(typeof mask !== "object" || Array.isArray(mask))
		) {
			return { error: "mask must be an object with an 'action' property" };
		}

		if (mask && !["add", "update", "remove"].includes(mask.action)) {
			return { error: "mask.action must be 'add', 'update', or 'remove'" };
		}

		const resolved = resolveTargetsToElementIds(raw, context);
		if ("error" in resolved) return resolved;

		const updated: Array<{
			elementId: string;
			applied: Record<string, unknown>;
			state: Record<string, unknown>;
		}> = [];
		const skipped: string[] = [];
		const results: ToolResultEntry[] = [];

		for (const elementId of resolved.elementIds) {
			const result = EditorContextAdapter.updateClip({
				elementId,
				name,
				mask,
				trimStart,
				trimEnd,
				opacity,
				positionX,
				positionY,
				rotation,
				scaleX,
				scaleY,
				blendMode,
				hidden,
				volume,
				muted,
			});
			if ("error" in result) {
				skipped.push(elementId);
				const reasonCode = classifyClipError(result.error);
				results.push({
					target: elementId,
					status: "failed",
					reasonCode,
					reason: result.error,
				});
			} else {
				updated.push({ elementId, applied: result.applied, state: result.state });
				results.push({
					target: elementId,
					status: "updated",
					state: result.state,
				});
			}
		}

		if (updated.length === 0) {
			return { error: "All targets failed to update", results };
		}

		return { success: true, updated, skipped, results };
	},
};

toolRegistry.register(updateClipSchema.name, updateClipTool);
