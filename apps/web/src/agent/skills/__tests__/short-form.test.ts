import { describe, expect, test } from "bun:test";
import { skillRegistry } from "../registry";
import type { SkillDefinition } from "../types";

// Import so the skill self-registers
import "../builtin/short-form.skill";

describe("short-form skill", () => {
	const skill = skillRegistry.get("short-form") as SkillDefinition;

	test("is registered", () => {
		expect(skill).toBeDefined();
		expect(skill.id).toBe("short-form");
	});

	test("creative questions section requires ask_user", () => {
		expect(skill.instructions).toContain("ask_user");
		expect(skill.instructions).toMatch(
			/MUST.*ask_user|ask_user.*MUST/i,
		);
	});

	test("creative questions must be asked BEFORE executing or planning", () => {
		expect(skill.instructions).toMatch(
			/ask.*BEFORE.*execut|ask.*BEFORE.*plan|BEFORE.*execut.*ask/i,
		);
	});

	test("creative questions section prohibits assistant prose", () => {
		expect(skill.instructions).toMatch(
			/never ask.*normal assistant prose|not.*assistant prose/i,
		);
	});
});
