import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { loadSkillSchema } from "@/agent/tools/schemas";
import { skillRegistry } from "@/agent/skills/registry";
import "@/agent/skills";

type LoadSkillResult =
	| {
			skillId: string;
			name: string;
			instructions: string;
	  }
	| { error: string };

const loadSkillTool: ToolDefinition = {
	...loadSkillSchema,
	execute: async (
		args: Record<string, unknown>,
		_context: AgentContext,
	): Promise<LoadSkillResult> => {
		const skillId = args.skillId;
		if (typeof skillId !== "string" || !skillId.trim()) {
			return { error: "skillId must be a non-empty string" };
		}

		if (!skillRegistry.has(skillId)) {
			const available = skillRegistry
				.getAll()
				.map((s) => s.id)
				.join(", ");
			return {
				error: `Skill not found: ${skillId}. Available skills: ${available}`,
			};
		}

		const skill = skillRegistry.get(skillId);
		return {
			skillId: skill.id,
			name: skill.name,
			instructions: skill.instructions,
		};
	},
};

toolRegistry.register(loadSkillSchema.name, loadSkillTool);
