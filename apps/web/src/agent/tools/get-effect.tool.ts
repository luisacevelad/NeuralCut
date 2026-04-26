import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { getEffectSchema } from "@/agent/tools/schemas";
import { effectsRegistry } from "@/lib/effects";
import type { ParamDefinition } from "@/lib/params";

type GetEffectResult = {
	id: string;
	name: string;
	description: string;
	params: Array<{
		key: string;
		label: string;
		type: "number" | "boolean" | "color" | "select";
		default: number | string | boolean;
		min?: number;
		max?: number;
		step?: number;
		options?: Array<{ value: string; label: string }>;
		description: string;
	}>;
};

function buildParamDescription(param: ParamDefinition): string {
	if (param.type === "number") {
		const parts: string[] = [`Number between ${param.min ?? "-∞"}`];
		if (param.max !== undefined) parts.push(`and ${param.max}`);
		if (param.step !== undefined) parts.push(`(step ${param.step})`);
		parts.push(`Default: ${param.default}`);
		return parts.join(" ");
	}
	if (param.type === "boolean") {
		return `Boolean. Default: ${param.default}`;
	}
	if (param.type === "color") {
		return `Color (hex string). Default: ${param.default}`;
	}
	if (param.type === "select") {
		const options = param.options.map((o) => `${o.value} (${o.label})`).join(", ");
		return `Select one of: ${options}. Default: ${param.default}`;
	}
	return "";
}

const getEffectTool: ToolDefinition = {
	...getEffectSchema,
	execute: async (
		args: Record<string, unknown>,
		_context: AgentContext,
	): Promise<GetEffectResult | { error: string }> => {
		const effectType = args.effectType;
		if (typeof effectType !== "string" || !effectType.trim()) {
			return { error: "Invalid effect type" };
		}

		if (!effectsRegistry.has(effectType)) {
			return { error: `Effect not found: ${effectType}` };
		}

		const definition = effectsRegistry.get(effectType);

		const params = definition.params.map((param) => {
			const base: GetEffectResult["params"][number] = {
				key: param.key,
				label: param.label,
				type: param.type,
				default: param.default,
				description: buildParamDescription(param),
			};

			if (param.type === "number") {
				if (param.min !== undefined) base.min = param.min;
				if (param.max !== undefined) base.max = param.max;
				if (param.step !== undefined) base.step = param.step;
			}

			if (param.type === "select") {
				base.options = param.options;
			}

			return base;
		});

		return {
			id: definition.type,
			name: definition.name,
			description: definition.keywords.join(", "),
			params,
		};
	},
};

toolRegistry.register(getEffectSchema.name, getEffectTool);
