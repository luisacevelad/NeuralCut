/**
 * Global text constraints for add_text and update_text.
 *
 * Enforced at the tool validation layer — hard-stop errors, no clamping.
 * Orientation is determined from AgentContext.resolution:
 *   - vertical (height > width): max 3 words
 *   - horizontal (width > height): max 6 words if total chars ≤ threshold, else max 5
 *   - unknown (no resolution): falls back to max 3 words (safest)
 *
 * Char threshold for horizontal: 25 chars total — long enough for ~5 short
 * words but catches genuinely long text that would overflow.
 */

/** Hard bounds for fontSize. Decimals allowed. */
export const FONT_SIZE_MIN = 6;
export const FONT_SIZE_MAX = 15;

/** Max words for vertical / short-form canvas. */
export const VERTICAL_MAX_WORDS = 3;

/** Max words for horizontal canvas when total character count is short. */
export const HORIZONTAL_MAX_WORDS_SHORT = 6;

/** Max words for horizontal canvas when total character count is long. */
export const HORIZONTAL_MAX_WORDS_LONG = 5;

/**
 * Character-count threshold for the horizontal heuristic.
 * If total text length exceeds this, use the tighter word limit.
 */
export const HORIZONTAL_CHAR_THRESHOLD = 25;

export type TextConstraintError = { error: string };

/**
 * Validates fontSize is within the allowed range.
 * Returns an error object if out of bounds, null if valid.
 */
export function validateFontSize(
	fontSize: number | undefined,
): TextConstraintError | null {
	if (fontSize === undefined) return null;
	if (
		typeof fontSize !== "number" ||
		!Number.isFinite(fontSize) ||
		fontSize < FONT_SIZE_MIN ||
		fontSize > FONT_SIZE_MAX
	) {
		return {
			error: `fontSize must be between ${FONT_SIZE_MIN} and ${FONT_SIZE_MAX} inclusive (got ${fontSize})`,
		};
	}
	return null;
}

/**
 * Counts words in a string. Splits on whitespace, ignores empty segments.
 */
export function countWords(text: string): number {
	return text
		.trim()
		.split(/\s+/)
		.filter((w) => w.length > 0).length;
}

/**
 * Determines canvas orientation from resolution.
 * Returns "vertical" | "horizontal" | "unknown".
 */
export function getOrientation(
	resolution: { width: number; height: number } | null,
): "vertical" | "horizontal" | "unknown" {
	if (!resolution) return "unknown";
	if (resolution.height > resolution.width) return "vertical";
	if (resolution.width > resolution.height) return "horizontal";
	return "unknown"; // square: treat as safest fallback
}

/**
 * Returns the maximum word count for a given orientation and text content.
 */
export function getMaxWords(
	orientation: "vertical" | "horizontal" | "unknown",
	text: string,
): number {
	if (orientation === "horizontal") {
		return text.length <= HORIZONTAL_CHAR_THRESHOLD
			? HORIZONTAL_MAX_WORDS_SHORT
			: HORIZONTAL_MAX_WORDS_LONG;
	}
	// vertical or unknown → safest fallback
	return VERTICAL_MAX_WORDS;
}

/**
 * Validates text content word count against orientation-based limits.
 * Returns an error object if exceeded, null if valid.
 */
export function validateWordCount(
	text: string | undefined,
	resolution: { width: number; height: number } | null,
): TextConstraintError | null {
	if (text === undefined) return null;

	const trimmed = text.trim();
	if (trimmed.length === 0) return null; // empty handled elsewhere

	const orientation = getOrientation(resolution);
	const words = countWords(trimmed);
	const maxWords = getMaxWords(orientation, trimmed);

	if (words > maxWords) {
		const label =
			orientation === "horizontal"
				? `horizontal (${maxWords} max)`
				: orientation === "vertical"
					? `vertical (${maxWords} max)`
					: `unknown orientation, using safest fallback (${maxWords} max)`;
		return {
			error: `Text has ${words} words, exceeds ${label}. Shorten the text.`,
		};
	}
	return null;
}
