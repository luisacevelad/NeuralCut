import { EditorCore } from "@/core";
import { TICKS_PER_SECOND } from "@/lib/wasm";
import { buildContextFromEditorState } from "@/agent/context-mapper";
import type { SceneTracks } from "@/lib/timeline";

/**
 * Thin adapter: the ONLY file in agent/ that imports from core/.
 * Returns a plain AgentContext POJO so tools never touch EditorCore directly.
 * Data mapping logic is extracted to context-mapper.ts for WASM-free testability.
 */
export const EditorContextAdapter = {
	getContext() {
		const core = EditorCore.getInstance();
		return buildContextFromEditorState({
			project: core.project.getActiveOrNull(),
			activeScene: core.scenes.getActiveSceneOrNull(),
			assets: core.media.getAssets(),
			currentTimeTicks: core.playback.getCurrentTime(),
			ticksPerSecond: TICKS_PER_SECOND,
		});
	},

	/**
	 * Resolve a media asset's File reference.
	 * If assetId is provided, finds the exact asset by ID.
	 * If omitted, returns the File for the first video or audio asset.
	 * Returns null when no matching asset exists.
	 * This is the ONLY sanctioned path for tools to obtain a File from EditorCore.
	 */
	resolveAssetFile(assetId?: string): File | null {
		const core = EditorCore.getInstance();
		const assets = core.media.getAssets();

		if (assetId !== undefined) {
			const asset = assets.find((a) => a.id === assetId);
			return asset?.file ?? null;
		}

		const firstMediaAsset = assets.find(
			(a) => a.type === "video" || a.type === "audio",
		);
		return firstMediaAsset?.file ?? null;
	},

	/**
	 * Check whether a media asset has an audio track.
	 * Returns undefined when the asset is not found.
	 */
	getAssetHasAudio(assetId: string): boolean | undefined {
		const core = EditorCore.getInstance();
		const asset = core.media.getAssets().find((a) => a.id === assetId);
		return asset?.hasAudio;
	},

	splitTimeline({
		times,
	}: {
		times: number[];
	}): { success: boolean; affectedElements: string[] } | { error: string } {
		const core = EditorCore.getInstance();
		const activeScene = core.scenes.getActiveSceneOrNull();
		if (!activeScene) {
			return { error: "No active timeline" };
		}

		if (!hasTimelineContent(activeScene.tracks)) {
			return { error: "No timeline content" };
		}

		const affectedElements = core.timeline.split({
			times: times.map((time) => secondsToTicks(time)),
		});
		return { success: true, affectedElements };
	},
};

function secondsToTicks(seconds: number): number {
	return Math.round(seconds * TICKS_PER_SECOND);
}

function hasTimelineContent(tracks: SceneTracks): boolean {
	return (
		tracks.main.elements.length > 0 ||
		tracks.overlay.some((track) => track.elements.length > 0) ||
		tracks.audio.some((track) => track.elements.length > 0)
	);
}

export { buildSystemPrompt } from "@/agent/system-prompt";
