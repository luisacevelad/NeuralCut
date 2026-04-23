import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { globSync } from "node:fs";

/**
 * Static analysis test: verifies the import boundary constraint.
 * Only context.ts may import from @/core within the agent/ directory.
 */
describe("agent import boundary", () => {
	const AGENT_DIR = resolve(import.meta.dir, "..");
	const CORE_IMPORT_PATTERN = /from\s+["']@\/core/;

	function getAgentTsFiles(): string[] {
		return globSync("**/*.ts", { cwd: AGENT_DIR }).filter(
			(f) => !f.includes("__tests__"),
		);
	}

	test("only context.ts imports from @/core in agent/", () => {
		const files = getAgentTsFiles();
		const violators: string[] = [];

		for (const file of files) {
			const fullPath = resolve(AGENT_DIR, file);
			const content = readFileSync(fullPath, "utf-8");

			if (CORE_IMPORT_PATTERN.test(content)) {
				if (!file.endsWith("context.ts")) {
					violators.push(file);
				}
			}
		}

		expect(violators).toEqual([]);
	});

	test("context.ts does import from @/core (boundary file exists)", () => {
		const contextPath = resolve(AGENT_DIR, "context.ts");
		const content = readFileSync(contextPath, "utf-8");
		expect(CORE_IMPORT_PATTERN.test(content)).toBe(true);
	});

	test("orchestrator does not import from @/core", () => {
		const orchestratorPath = resolve(AGENT_DIR, "orchestrator.ts");
		const content = readFileSync(orchestratorPath, "utf-8");
		expect(CORE_IMPORT_PATTERN.test(content)).toBe(false);
	});
});
