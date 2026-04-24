import type { ProviderAdapter, ProviderConfig } from "./types";
import { OpenAICompatibleAdapter } from "./openai-compatible";
import { GeminiAdapter } from "./gemini";

/**
 * Factory — resolves a ProviderConfig to a concrete adapter.
 *
 * Extend the switch when new provider families are added.
 * Unknown providers throw immediately so mis-config is caught
 * at route call time, not silently.
 */
export function createProvider(config: ProviderConfig): ProviderAdapter {
	switch (config.provider) {
		case "openai-compatible":
			return new OpenAICompatibleAdapter(config);
		case "gemini":
			return new GeminiAdapter(config);
		default:
			throw new Error(`Unknown LLM provider: ${config.provider}`);
	}
}

export type { ProviderAdapter, ProviderConfig, ProviderResponse } from "./types";
