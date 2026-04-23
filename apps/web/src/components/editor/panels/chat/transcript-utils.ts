/**
 * Pure utilities for transcript data detection and formatting.
 * Extracted from MessageBubble for testability without React DOM.
 */

export interface TranscriptData {
	assetName: string;
	language: string;
	fullText: string;
	segments: Array<{ text: string; start: number; end: number }>;
	duration: number;
}

export function isTranscriptData(data: unknown): data is TranscriptData {
	return (
		typeof data === "object" &&
		data !== null &&
		"fullText" in data &&
		"segments" in data &&
		Array.isArray((data as TranscriptData).segments)
	);
}

export function formatTimestamp(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
