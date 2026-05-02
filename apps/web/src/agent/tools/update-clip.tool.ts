import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { updateClipSchema } from "@/agent/tools/schemas";
import { EditorContextAdapter } from "@/agent/context";
import { resolveTargetsToElementIds } from "@/agent/tools/resolve-element-ids";

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
						}>;
						skipped: string[];
				  }
				| { error: string }
		  >
		| { error: string } => {
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
		}> = [];
		const skipped: string[] = [];

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
			} else {
				updated.push({ elementId, applied: result.applied });
			}
		}

		if (updated.length === 0) {
			return { error: "All targets failed to update" };
		}

		return { success: true, updated, skipped };
	},
};

toolRegistry.register(updateClipSchema.name, updateClipTool);
