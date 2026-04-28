import type { AgentContext, ToolDefinition } from "@/agent/types";
import { toolRegistry } from "@/agent/tools/registry";
import { listSkillsSchema } from "@/agent/tools/schemas";
import { skillRegistry } from "@/agent/skills/registry";
import "@/agent/skills";

type ListSkillsResult = {
	skills: Array<{
		id: string;
		name: string;
		description: string;
		keywords: string[];
	}>;
};

const listSkillsTool: ToolDefinition = {
	...listSkillsSchema,
	execute: async (
		args: Record<string, unknown>,
		_context: AgentContext,
	): Promise<ListSkillsResult> => {
		const allSkills = skillRegistry.getAll();
		const query =
			typeof args.query === "string" ? args.query.trim().toLowerCase() : "";

		const skills = allSkills
			.filter((skill) => {
				if (!query) return true;
				const nameMatch = skill.name.toLowerCase().includes(query);
				const descMatch = skill.description.toLowerCase().includes(query);
				const keywordMatch = skill.keywords.some((kw) =>
					kw.toLowerCase().includes(query),
				);
				return nameMatch || descMatch || keywordMatch;
			})
			.map((skill) => ({
				id: skill.id,
				name: skill.name,
				description: skill.description,
				keywords: skill.keywords,
			}));

		return { skills };
	},
};

toolRegistry.register(listSkillsSchema.name, listSkillsTool);
