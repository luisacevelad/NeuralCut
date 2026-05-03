import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { listEffectsSchema } from "@/agent/tools/schemas";
import { effectsRegistry } from "@/lib/effects";

type ListEffectsResult = {
	effects: Array<{
		id: string;
		name: string;
		description: string;
	}>;
};

const DEFAULT_LIMIT = 10;

const listEffectsTool: ToolDefinition = {
	...listEffectsSchema,
	execute: async (
		args: Record<string, unknown>,
		_context: AgentContext,
	): Promise<ListEffectsResult> => {
		const allEffects = effectsRegistry.getAll();
		const query = typeof args.query === "string" ? args.query.trim().toLowerCase() : "";
		const rawLimit = args.limit;
		const limit =
			typeof rawLimit === "number" && rawLimit > 0
				? Math.min(rawLimit, allEffects.length)
				: DEFAULT_LIMIT;

		const effects = allEffects
			.filter((effect) => {
				if (!query) return true;
				const nameMatch = effect.name.toLowerCase().includes(query);
				const keywordMatch = effect.keywords.some((kw) =>
					kw.toLowerCase().includes(query),
				);
				return nameMatch || keywordMatch;
			})
			.map((effect) => ({
				id: effect.type,
				name: effect.name,
				description: effect.keywords.join(", "),
			}))
			.slice(0, limit);

		return { effects };
	},
};

toolRegistry.register(listEffectsSchema.name, listEffectsTool);
