import type { AgentContext } from "@/agent/types";
import { resolveElement } from "@/agent/ref-resolver";

export function resolveElementIds(raw: unknown): string[] | null {
	if (Array.isArray(raw)) {
		const ids = raw.filter(
			(id) => typeof id === "string" && id.trim().length > 0,
		);
		return ids.length > 0 ? ids : null;
	}

	if (typeof raw === "string" && raw.trim().length > 0) {
		const ids = raw
			.split(",")
			.map((id) => id.trim())
			.filter((id) => id.length > 0);
		return ids.length > 0 ? ids : null;
	}

	return null;
}

export function resolveTargetsToElementIds(
	targets: unknown,
	context: AgentContext,
): { elementIds: string[] } | { error: string } {
	const rawIds = resolveElementIds(targets);
	if (!rawIds) {
		return { error: "targets must be a non-empty array of element refs (e.g. 'clip-1', 'text-3') or element IDs." };
	}

	const elementIds: string[] = [];
	for (const target of rawIds) {
		const result = resolveElement(target, context);
		if ("error" in result) return result;
		elementIds.push(result.elementId);
	}
	return { elementIds };
}
