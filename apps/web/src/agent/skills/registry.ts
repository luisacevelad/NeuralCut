import { DefinitionRegistry } from "@/lib/registry";
import type { SkillDefinition } from "./types";

export const skillRegistry = new DefinitionRegistry<string, SkillDefinition>(
	"skill",
);
