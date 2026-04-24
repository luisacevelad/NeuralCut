import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";

type AssetTypeFilter = "all" | "video" | "audio" | "image";
type UsageFilter = "all" | "used" | "unused";

export type ListProjectAssetsArgs = {
	filter?: UsageFilter;
	type?: AssetTypeFilter;
};

export type ListProjectAssetsResult = {
	assets: Array<{
		id: string;
		name: string;
		type: "video" | "audio" | "image";
		duration?: number;
		usedInTimeline: boolean;
	}>;
};

type SupportedAsset = AgentContext["mediaAssets"][number] & {
	type: "video" | "audio" | "image";
};

const assetTypes = new Set<AssetTypeFilter>(["all", "video", "audio", "image"]);
const usageFilters = new Set<UsageFilter>(["all", "used", "unused"]);

const listProjectAssetsTool: ToolDefinition = {
	name: "list_project_assets",
	description:
		"Lists project media assets with stable ids, type, duration, and whether each asset is used in the active timeline.",
	parameters: [
		{ key: "filter", type: "string", required: false },
		{ key: "type", type: "string", required: false },
	],
	execute: async (
		args: Record<string, unknown>,
		context: AgentContext,
	): Promise<ListProjectAssetsResult | { error: string }> => {
		if (!context.projectId) {
			return { error: "No active project" };
		}

		const filter = (args.filter ?? "all") as UsageFilter;
		const type = (args.type ?? "all") as AssetTypeFilter;

		if (!usageFilters.has(filter)) {
			return { error: "Invalid asset usage filter" };
		}

		if (!assetTypes.has(type)) {
			return { error: "Invalid asset type filter" };
		}

		const assets = context.mediaAssets
			.filter(isSupportedAsset)
			.filter((asset) => type === "all" || asset.type === type)
			.filter((asset) => {
				const usedInTimeline = asset.usedInTimeline ?? false;
				if (filter === "used") return usedInTimeline;
				if (filter === "unused") return !usedInTimeline;
				return true;
			})
			.map((asset) => ({
				id: asset.id,
				name: asset.name,
				type: asset.type,
				...(asset.duration > 0 ? { duration: asset.duration } : {}),
				usedInTimeline: asset.usedInTimeline ?? false,
			}));

		return { assets };
	},
};

function isSupportedAsset(
	asset: AgentContext["mediaAssets"][number],
): asset is SupportedAsset {
	return (
		asset.type === "video" || asset.type === "audio" || asset.type === "image"
	);
}

toolRegistry.register("list_project_assets", listProjectAssetsTool);
