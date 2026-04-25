import { formatTimestamp } from "./transcript-utils";

export interface ToolSummary {
	label: string;
	description: string;
}

export function formatToolCall(
	name: string,
	args: Record<string, unknown>,
): ToolSummary {
	const formatter = TOOL_CALL_FORMATTERS[name];
	if (formatter) return formatter(args);

	return {
		label: formatToolName(name),
		description: summarizeArgs(args),
	};
}

export function formatToolResult(
	name: string,
	raw: string,
): ToolSummary | null {
	try {
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === "object" && "error" in parsed) {
			return {
				label: formatToolName(name),
				description: String(parsed.error),
			};
		}
		const formatter = TOOL_RESULT_FORMATTERS[name];
		if (formatter) return formatter(parsed);
		return null;
	} catch {
		return null;
	}
}

function formatToolName(name: string): string {
	return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSeconds(s: unknown): string {
	if (typeof s !== "number" || !Number.isFinite(s)) return "?";
	return formatTimestamp(s);
}

function summarizeArgs(args: Record<string, unknown>): string {
	const entries = Object.entries(args);
	if (entries.length === 0) return "No arguments";
	return entries
		.map(([key, val]) => {
			if (Array.isArray(val)) {
				return `${key}: [${val.length} items]`;
			}
			if (typeof val === "object" && val !== null) {
				return `${key}: {...}`;
			}
			return `${key}: ${String(val)}`;
		})
		.join(", ");
}

const TOOL_CALL_FORMATTERS: Record<
	string,
	(args: Record<string, unknown>) => ToolSummary
> = {
	split: (args) => {
		const times = args.times as number[] | undefined;
		if (!times || times.length === 0)
			return { label: "Split", description: "No times specified" };
		const formatted = times.map((t) => formatSeconds(t)).join(", ");
		return {
			label: "Split",
			description: `at ${formatted}`,
		};
	},
	load_context: (args) => {
		const targetType = String(args.targetType ?? "unknown");
		const id = args.id ?? args.assetId ?? args.elementId;
		if (targetType === "asset") {
			return {
				label: "Load Asset",
				description: id ? String(id) : "Loading asset...",
			};
		}
		return {
			label: "Load Context",
			description: id ? `${targetType} ${String(id)}` : targetType,
		};
	},
	list_timeline: () => ({
		label: "List Timeline",
		description: "Fetching timeline tracks",
	}),
	list_project_assets: (args) => {
		const type = args.type ?? "all";
		const filter = args.filter ?? "all";
		const parts: string[] = [];
		if (type !== "all") parts.push(String(type));
		if (filter !== "all") parts.push(String(filter));
		return {
			label: "List Assets",
			description:
				parts.length > 0 ? parts.join(", ") : "Fetching project assets",
		};
	},
	transcribe_video: (args) => {
		const lang = args.language ? String(args.language) : null;
		return {
			label: "Transcribe",
			description: lang ? `language: ${lang}` : "Transcribing audio",
		};
	},
};

const TOOL_RESULT_FORMATTERS: Record<
	string,
	(parsed: unknown) => ToolSummary | null
> = {
	split: (parsed) => {
		const data = parsed as {
			success?: boolean;
			affectedElements?: string[];
		} | null;
		if (!data) return null;
		const count = data.affectedElements?.length ?? 0;
		return {
			label: "Split",
			description: data.success
				? `${count} element${count !== 1 ? "s" : ""} affected`
				: "Failed",
		};
	},
	load_context: (parsed) => {
		const data = parsed as {
			status?: string;
			cached?: boolean;
			context?: { kind?: string; assetName?: string };
		} | null;
		if (!data) return null;
		const assetName = data.context?.assetName;
		const cached = data.cached ? " (cached)" : "";
		return {
			label: "Load Context",
			description: assetName
				? `${assetName}${cached}`
				: `${data.status ?? "loaded"}${cached}`,
		};
	},
	list_timeline: (parsed) => {
		const data = parsed as { tracks?: unknown[] } | null;
		if (!data) return null;
		const count = data.tracks?.length ?? 0;
		return {
			label: "Timeline",
			description: `${count} track${count !== 1 ? "s" : ""}`,
		};
	},
	list_project_assets: (parsed) => {
		const data = parsed as { assets?: unknown[] } | null;
		if (!data) return null;
		const count = data.assets?.length ?? 0;
		return {
			label: "Assets",
			description: `${count} asset${count !== 1 ? "s" : ""}`,
		};
	},
	transcribe_video: (parsed) => {
		const data = parsed as {
			assetName?: string;
			language?: string;
			segmentCount?: number;
			duration?: number;
		} | null;
		if (!data) return null;
		return {
			label: "Transcript",
			description: `${data.assetName ?? "audio"} · ${data.segmentCount ?? 0} segments`,
		};
	},
};
