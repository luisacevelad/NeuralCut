import { DefinitionRegistry } from "@/lib/registry";
import type { ToolDefinition, ToolSchema } from "@/agent/types";

export const toolRegistry = new DefinitionRegistry<string, ToolDefinition>(
	"tool",
);

/**
 * Exports registered tools as provider-agnostic schemas (pure data DTOs).
 * Adapters convert these to their wire format; `execute` is never exposed.
 */
export function toToolSchemas(
	tools: ToolDefinition[] = toolRegistry.getAll(),
): ToolSchema[] {
	return tools.map(({ name, description, parameters }) => ({
		name,
		description,
		parameters,
	}));
}
