/**
 * Structured result types for agent tools that operate on multiple targets.
 *
 * Provides semantic telemetry so the agent knows WHAT happened and WHY,
 * enabling actionable decisions without guesswork.
 */

export type ReasonCode =
	| "TARGET_NOT_FOUND"
	| "UNSUPPORTED_ELEMENT_TYPE"
	| "NO_OP"
	| "INTERNAL_ERROR";

export type ToolResultEntry = {
	/** Reference or ID of the target element */
	target: string;
	/** Outcome of the operation on this target */
	status: "updated" | "skipped" | "failed";
	/** Machine-readable reason for skips/failures */
	reasonCode?: ReasonCode;
	/** Human-readable explanation */
	reason?: string;
	/** Serialized element state after a successful update */
	state?: Record<string, unknown>;
};
