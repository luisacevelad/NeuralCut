import { describe, expect, test } from "bun:test";
import { toToolSchemas } from "@/agent/tools/registry";
import type { ToolDefinition } from "@/agent/types";

describe("toToolSchemas()", () => {
	test("strips execute from tool definitions, returning pure data schemas", () => {
		const tools: ToolDefinition[] = [
			{
				name: "test_tool",
				description: "A test tool",
				parameters: [
					{ key: "input", type: "string", required: true },
					{ key: "count", type: "number", required: false },
				],
				execute: async () => ({ result: "never called" }),
			},
		];

		const schemas = toToolSchemas(tools);

		expect(schemas).toHaveLength(1);
		expect(schemas[0]).toEqual({
			name: "test_tool",
			description: "A test tool",
			parameters: [
				{ key: "input", type: "string", required: true },
				{ key: "count", type: "number", required: false },
			],
		});

		// Confirm no execute property leaked
		expect("execute" in schemas[0]).toBe(false);
	});

	test("returns empty array for empty input", () => {
		expect(toToolSchemas([])).toEqual([]);
	});

	test("preserves all parameter metadata including required flag", () => {
		const tools: ToolDefinition[] = [
			{
				name: "tool_with_required",
				description: "Has required params",
				parameters: [
					{ key: "a", type: "string", required: true },
					{ key: "b", type: "number", required: true },
					{ key: "c", type: "boolean", required: false },
				],
				execute: async () => ({}),
			},
		];

		const schemas = toToolSchemas(tools);
		expect(schemas[0].parameters).toEqual([
			{ key: "a", type: "string", required: true },
			{ key: "b", type: "number", required: true },
			{ key: "c", type: "boolean", required: false },
		]);
	});
});
