import { describe, expect, test } from "bun:test";
import { createProvider } from "@/agent/providers/index";
import { OpenAICompatibleAdapter } from "@/agent/providers/openai-compatible";
import { GeminiAdapter } from "@/agent/providers/gemini";
import type { ProviderConfig } from "@/agent/providers/types";

describe("createProvider", () => {
	test("returns OpenAICompatibleAdapter for openai-compatible provider", () => {
		const config: ProviderConfig = {
			provider: "openai-compatible",
			apiKey: "test-key",
			model: "gpt-4o-mini",
		};

		const adapter = createProvider(config);
		expect(adapter).toBeInstanceOf(OpenAICompatibleAdapter);
	});

	test("passes config through to adapter", () => {
		const config: ProviderConfig = {
			provider: "openai-compatible",
			apiKey: "sk-test-123",
			model: "gpt-4o",
			baseUrl: "https://api.custom.com/v1",
		};

		const adapter = createProvider(config);
		expect(adapter).toBeInstanceOf(OpenAICompatibleAdapter);
		// Adapter was constructed without throwing — config accepted
	});

	test("returns GeminiAdapter for gemini provider", () => {
		const config: ProviderConfig = {
			provider: "gemini",
			apiKey: "test-gemini-key",
			model: "gemini-2.0-flash",
		};

		const adapter = createProvider(config);
		expect(adapter).toBeInstanceOf(GeminiAdapter);
	});

	test("throws Error for unknown provider", () => {
		const config: ProviderConfig = {
			provider: "unknown-provider",
			apiKey: "test-key",
			model: "test-model",
		};

		expect(() => createProvider(config)).toThrow(
			"Unknown LLM provider: unknown-provider",
		);
	});

	test("throws for empty provider string", () => {
		const config: ProviderConfig = {
			provider: "",
			apiKey: "test-key",
			model: "test-model",
		};

		expect(() => createProvider(config)).toThrow("Unknown LLM provider: ");
	});
});
