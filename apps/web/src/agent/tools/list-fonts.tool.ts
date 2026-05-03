import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { listFontsSchema } from "@/agent/tools/schemas";
import { ALL_FONT_NAMES } from "@/lib/fonts/catalog";

type ListFontsResult = {
	fonts: Array<{ name: string }>;
};

const DEFAULT_LIMIT = 10;

const listFontsTool: ToolDefinition = {
	...listFontsSchema,
	execute: async (
		args: Record<string, unknown>,
		_context: AgentContext,
	): Promise<ListFontsResult> => {
		const query =
			typeof args.query === "string" ? args.query.trim().toLowerCase() : "";
		const rawLimit = args.limit;
		const limit =
			typeof rawLimit === "number" && rawLimit > 0
				? Math.min(rawLimit, ALL_FONT_NAMES.length)
				: DEFAULT_LIMIT;

		const filtered = query
			? ALL_FONT_NAMES.filter((name) =>
					name.toLowerCase().includes(query),
				)
			: ALL_FONT_NAMES;

		const fonts = filtered.slice(0, limit).map((name) => ({ name }));

		return { fonts };
	},
};

toolRegistry.register(listFontsSchema.name, listFontsTool);
