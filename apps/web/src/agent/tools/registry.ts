import { DefinitionRegistry } from "@/lib/registry";
import type { ToolDefinition } from "@/agent/types";

export const toolRegistry = new DefinitionRegistry<string, ToolDefinition>(
	"tool",
);
