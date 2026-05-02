import type { AgentContext, ToolDefinition } from "@/agent/types";
import { EditorContextAdapter } from "@/agent/context";
import { toolRegistry } from "@/agent/tools/registry";
import { renderPreviewSchema } from "@/agent/tools/schemas";
import { uploadFileToGemini } from "@/agent/tools/upload-to-gemini";

type RenderPreviewResult =
	| {
			status: "rendered";
			duration: number;
			format: "mp4";
			context: {
				kind: "media";
				assetName: string;
				fileUri: string;
				mimeType: string;
			};
	  }
	| { error: string };

const renderPreviewTool: ToolDefinition = {
	...renderPreviewSchema,
	execute: async (
		_args: Record<string, unknown>,
		_context: AgentContext,
	): Promise<RenderPreviewResult> => {
		const preview = await EditorContextAdapter.exportPreview();
		if ("error" in preview) {
			return { error: preview.error };
		}

		const file = new File([preview.buffer], "_preview.mp4", {
			type: "video/mp4",
		});

		const uploaded = await uploadFileToGemini({
			file,
			displayName: "_preview.mp4",
			mimeType: "video/mp4",
		});

		if ("error" in uploaded) {
			return { error: uploaded.error };
		}

		return {
			status: "rendered",
			duration: Math.round(preview.duration * 1000) / 1000,
			format: "mp4",
			context: {
				kind: "media",
				assetName: "_preview.mp4",
				fileUri: uploaded.fileUri,
				mimeType: uploaded.mimeType,
			},
		};
	},
};

toolRegistry.register(renderPreviewSchema.name, renderPreviewTool);
