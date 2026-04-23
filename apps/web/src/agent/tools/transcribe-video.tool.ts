import type { AgentContext, ToolDefinition } from "@/agent/types";
import type {
	TranscriptionLanguage,
	TranscriptionModelId,
} from "@/lib/transcription/types";
import { toolRegistry } from "@/agent/tools/registry";
import { EditorContextAdapter } from "@/agent/context";
import { decodeAudioToFloat32 } from "@/lib/media/audio";
import { transcriptionService } from "@/services/transcription/service";

export type TranscriptionToolResult = {
	assetName: string;
	language: string;
	fullText: string;
	segmentCount: number;
	segments: Array<{ text: string; start: number; end: number }>;
	duration: number;
};

export type TranscribeVideoArgs = {
	assetId?: string;
	language?: TranscriptionLanguage;
	modelId?: TranscriptionModelId;
};

const transcribeVideoTool: ToolDefinition = {
	name: "transcribe_video",
	description:
		"Transcribes the audio of a video or audio asset using Whisper. Returns structured transcript with segments and timestamps.",
	parameters: [
		{ key: "assetId", type: "string", required: false },
		{ key: "language", type: "string", required: false },
		{ key: "modelId", type: "string", required: false },
	],
	execute: async (
		args: Record<string, unknown>,
		context: AgentContext,
	): Promise<TranscriptionToolResult | { error: string }> => {
		const typedArgs = args as TranscribeVideoArgs;

		// Validate: must have media assets
		if (context.mediaAssets.length === 0) {
			return { error: "No active media asset" };
		}

		// Find candidate assets (video or audio only)
		const mediaCandidates = context.mediaAssets.filter(
			(a) => a.type === "video" || a.type === "audio",
		);

		if (mediaCandidates.length === 0) {
			// Assets exist but none are video/audio (e.g. images only)
			return { error: "Asset has no audio track" };
		}

		// Resolve the target asset
		let targetAsset: (typeof mediaCandidates)[number] | undefined;

		if (typedArgs.assetId) {
			targetAsset = mediaCandidates.find((a) => a.id === typedArgs.assetId);
			if (!targetAsset) {
				return {
					error: `Could not access file for asset ${typedArgs.assetId}`,
				};
			}
		} else {
			if (mediaCandidates.length > 1) {
				const names = mediaCandidates.map((a) => a.name).join(", ");
				return {
					error: `Multiple video/audio assets found: ${names}. Specify which one with assetId.`,
				};
			}
			targetAsset = mediaCandidates[0];
		}

		// Resolve the actual File via the adapter
		const file = EditorContextAdapter.resolveAssetFile(targetAsset.id);
		if (!file) {
			return { error: `Could not access file for asset ${targetAsset.id}` };
		}

		// Guard: asset must have an audio track
		const hasAudio = EditorContextAdapter.getAssetHasAudio(targetAsset.id);
		if (hasAudio === false) {
			return { error: "Asset has no audio track" };
		}

		try {
			// Decode audio → Float32Array
			const { samples } = await decodeAudioToFloat32({
				audioBlob: file,
				sampleRate: 16000,
			});

			// Run Whisper transcription
			const result = await transcriptionService.transcribe({
				audioData: samples,
				language: typedArgs.language ?? "auto",
				modelId: typedArgs.modelId ?? "whisper-small",
			});

			return {
				assetName: targetAsset.name,
				language: result.language,
				fullText: result.text,
				segmentCount: result.segments.length,
				segments: result.segments,
				duration: targetAsset.duration,
			};
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Transcription failed";
			return { error: message };
		}
	},
};

toolRegistry.register("transcribe_video", transcribeVideoTool);
