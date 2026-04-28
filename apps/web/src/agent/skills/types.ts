export interface SkillDefinition {
	id: string;
	name: string;
	description: string;
	keywords: string[];
	instructions: string;
	author: "system" | "user";
}
