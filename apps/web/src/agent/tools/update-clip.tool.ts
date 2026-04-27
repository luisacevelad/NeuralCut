import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { updateClipSchema } from "@/agent/tools/schemas";
import { EditorContextAdapter } from "@/agent/context";

const updateClipTool: ToolDefinition = {
	...updateClipSchema,
	execute: async (
		args: Record<string, unknown>,
		_context: AgentContext,
	): Promise<
		| { success: boolean; elementId: string; applied: Record<string, unknown> }
		| { error: string }
	> => {
		const elementId = args.elementId;
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

		if (typeof elementId !== "string" || !elementId.trim()) {
			return { error: "Invalid elementId" };
		}

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

		return EditorContextAdapter.updateClip({
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
	},
};

toolRegistry.register(updateClipSchema.name, updateClipTool);
