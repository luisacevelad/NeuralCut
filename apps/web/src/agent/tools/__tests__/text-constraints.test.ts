import { describe, expect, test } from "bun:test";
import {
	FONT_SIZE_MIN,
	FONT_SIZE_MAX,
	VERTICAL_MAX_WORDS,
	HORIZONTAL_MAX_WORDS_SHORT,
	HORIZONTAL_MAX_WORDS_LONG,
	HORIZONTAL_CHAR_THRESHOLD,
	validateFontSize,
	countWords,
	getOrientation,
	getMaxWords,
	validateWordCount,
} from "@/agent/tools/text-constraints";

describe("text-constraints constants", () => {
	test("fontSize range is 6–15", () => {
		expect(FONT_SIZE_MIN).toBe(6);
		expect(FONT_SIZE_MAX).toBe(15);
	});

	test("vertical max words is 3", () => {
		expect(VERTICAL_MAX_WORDS).toBe(3);
	});

	test("horizontal max words is 6 (short) and 5 (long)", () => {
		expect(HORIZONTAL_MAX_WORDS_SHORT).toBe(6);
		expect(HORIZONTAL_MAX_WORDS_LONG).toBe(5);
	});
});

describe("validateFontSize", () => {
	test("returns null for undefined (not provided)", () => {
		expect(validateFontSize(undefined)).toBeNull();
	});

	test("returns null for valid fontSize within range", () => {
		expect(validateFontSize(6)).toBeNull();
		expect(validateFontSize(15)).toBeNull();
		expect(validateFontSize(10)).toBeNull();
		expect(validateFontSize(6.5)).toBeNull();
		expect(validateFontSize(14.9)).toBeNull();
	});

	test("returns error for fontSize below minimum", () => {
		const result = validateFontSize(5);
		expect(result).not.toBeNull();
		expect(result!.error).toContain("6");
		expect(result!.error).toContain("15");
		expect(result!.error).toContain("5");
	});

	test("returns error for fontSize above maximum", () => {
		const result = validateFontSize(16);
		expect(result).not.toBeNull();
		expect(result!.error).toContain("16");
	});

	test("returns error for zero", () => {
		expect(validateFontSize(0)).not.toBeNull();
	});

	test("returns error for negative", () => {
		expect(validateFontSize(-1)).not.toBeNull();
	});

	test("returns error for NaN", () => {
		expect(validateFontSize(Number.NaN)).not.toBeNull();
	});

	test("returns error for Infinity", () => {
		expect(validateFontSize(Number.POSITIVE_INFINITY)).not.toBeNull();
	});
});

describe("countWords", () => {
	test("counts single word", () => {
		expect(countWords("Hello")).toBe(1);
	});

	test("counts multiple words", () => {
		expect(countWords("one two three")).toBe(3);
	});

	test("handles extra whitespace", () => {
		expect(countWords("  hello   world  ")).toBe(2);
	});

	test("returns 0 for empty string", () => {
		expect(countWords("")).toBe(0);
	});

	test("returns 0 for whitespace-only string", () => {
		expect(countWords("   ")).toBe(0);
	});
});

describe("getOrientation", () => {
	test("returns vertical when height > width", () => {
		expect(getOrientation({ width: 1080, height: 1920 })).toBe("vertical");
	});

	test("returns horizontal when width > height", () => {
		expect(getOrientation({ width: 1920, height: 1080 })).toBe("horizontal");
	});

	test("returns unknown for null resolution", () => {
		expect(getOrientation(null)).toBe("unknown");
	});

	test("returns unknown for square canvas (width === height)", () => {
		expect(getOrientation({ width: 1080, height: 1080 })).toBe("unknown");
	});
});

describe("getMaxWords", () => {
	test("returns 3 for vertical", () => {
		expect(getMaxWords("vertical", "hello world")).toBe(3);
	});

	test("returns 6 for horizontal with short text", () => {
		expect(getMaxWords("horizontal", "a b c d e")).toBe(
			HORIZONTAL_MAX_WORDS_SHORT,
		);
	});

	test("returns 5 for horizontal with long text", () => {
		const longText = "a".repeat(HORIZONTAL_CHAR_THRESHOLD + 1);
		expect(getMaxWords("horizontal", longText)).toBe(
			HORIZONTAL_MAX_WORDS_LONG,
		);
	});

	test("returns 3 for unknown orientation", () => {
		expect(getMaxWords("unknown", "hello")).toBe(3);
	});
});

describe("validateWordCount", () => {
	test("returns null for undefined content", () => {
		expect(validateWordCount(undefined, { width: 1920, height: 1080 })).toBeNull();
	});

	test("returns null for empty/whitespace content", () => {
		expect(validateWordCount("", { width: 1920, height: 1080 })).toBeNull();
		expect(validateWordCount("  ", { width: 1920, height: 1080 })).toBeNull();
	});

	test("allows 3 words on vertical canvas", () => {
		expect(
			validateWordCount("one two three", { width: 1080, height: 1920 }),
		).toBeNull();
	});

	test("rejects 4 words on vertical canvas", () => {
		const result = validateWordCount("one two three four", {
			width: 1080,
			height: 1920,
		});
		expect(result).not.toBeNull();
		expect(result!.error).toContain("4 words");
		expect(result!.error).toContain("vertical");
	});

	test("allows 6 words on horizontal canvas with short text", () => {
		expect(
			validateWordCount("hi my name is bob ok", {
				width: 1920,
				height: 1080,
			}),
		).toBeNull();
	});

	test("rejects 7 words on horizontal canvas", () => {
		const result = validateWordCount("a b c d e f g", {
			width: 1920,
			height: 1080,
		});
		expect(result).not.toBeNull();
		expect(result!.error).toContain("7 words");
	});

	test("allows 5 words on horizontal canvas with long text", () => {
		// Each word is long enough to exceed the char threshold at 5 words
		const text = "international documentation consequence unbelievable extraordinary";
		expect(
			validateWordCount(text, { width: 1920, height: 1080 }),
		).toBeNull();
	});

	test("rejects 6 words on horizontal canvas when total chars exceed threshold", () => {
		const text = "international documentation consequence unbelievable extraordinary however";
		const result = validateWordCount(text, { width: 1920, height: 1080 });
		expect(result).not.toBeNull();
		expect(result!.error).toContain("6 words");
	});

	test("uses safest fallback (3 words) when resolution is null", () => {
		expect(validateWordCount("one two three", null)).toBeNull();
		const result = validateWordCount("one two three four", null);
		expect(result).not.toBeNull();
		expect(result!.error).toContain("unknown orientation");
	});

	test("uses safest fallback for square canvas", () => {
		expect(
			validateWordCount("one two three", { width: 1080, height: 1080 }),
		).toBeNull();
		const result = validateWordCount("one two three four", {
			width: 1080,
			height: 1080,
		});
		expect(result).not.toBeNull();
	});
});
