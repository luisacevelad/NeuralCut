import { describe, expect, test } from "bun:test";
import {
	isTranscriptData,
	formatTimestamp,
} from "../transcript-utils";

describe("isTranscriptData — transcript detection", () => {
	test("returns true for valid transcript data", () => {
		const data = {
			assetName: "clip.mp4",
			language: "en",
			fullText: "Hello world",
			segments: [{ text: "Hello world", start: 0, end: 2.5 }],
			duration: 30,
		};

		expect(isTranscriptData(data)).toBe(true);
	});

	test("returns true for transcript with empty segments array", () => {
		const data = {
			assetName: "clip.mp4",
			language: "en",
			fullText: "",
			segments: [],
			duration: 0,
		};

		expect(isTranscriptData(data)).toBe(true);
	});

	test("returns false when fullText is missing", () => {
		const data = {
			assetName: "clip.mp4",
			language: "en",
			segments: [{ text: "Hello", start: 0, end: 1 }],
			duration: 30,
		};

		expect(isTranscriptData(data)).toBe(false);
	});

	test("returns false when segments is missing", () => {
		const data = {
			assetName: "clip.mp4",
			language: "en",
			fullText: "Hello",
			duration: 30,
		};

		expect(isTranscriptData(data)).toBe(false);
	});

	test("returns false when segments is not an array", () => {
		const data = {
			assetName: "clip.mp4",
			fullText: "Hello",
			segments: "not an array",
			duration: 30,
		};

		expect(isTranscriptData(data)).toBe(false);
	});

	test("returns false for null", () => {
		expect(isTranscriptData(null)).toBe(false);
	});

	test("returns false for non-transcript tool result", () => {
		const data = { projectId: "p1", mediaCount: 2 };

		expect(isTranscriptData(data)).toBe(false);
	});

	test("returns false for a plain string", () => {
		expect(isTranscriptData("some text")).toBe(false);
	});

	test("detects transcript from JSON.parse of tool_result content", () => {
		const toolResultContent = JSON.stringify({
			assetName: "clip.mp4",
			language: "en",
			fullText: "Hello world, this is a test.",
			segments: [
				{ text: "Hello world,", start: 0, end: 2.5 },
				{ text: "this is a test.", start: 2.5, end: 5.0 },
			],
			duration: 30,
		});

		const parsed = JSON.parse(toolResultContent);
		expect(isTranscriptData(parsed)).toBe(true);
	});

	test("does not detect error results as transcript", () => {
		const toolResultContent = JSON.stringify({
			error: "No active media asset",
		});

		const parsed = JSON.parse(toolResultContent);
		expect(isTranscriptData(parsed)).toBe(false);
	});
});

describe("formatTimestamp — timestamp formatting", () => {
	test("formats zero seconds as 00:00", () => {
		expect(formatTimestamp(0)).toBe("00:00");
	});

	test("formats seconds under a minute", () => {
		expect(formatTimestamp(45)).toBe("00:45");
	});

	test("formats exact minutes", () => {
		expect(formatTimestamp(120)).toBe("02:00");
	});

	test("formats minutes and seconds", () => {
		expect(formatTimestamp(125)).toBe("02:05");
	});

	test("pads single-digit seconds", () => {
		expect(formatTimestamp(61)).toBe("01:01");
	});

	test("formats large durations", () => {
		expect(formatTimestamp(3661)).toBe("61:01");
	});

	test("formats segment start time matching spec [MM:SS]", () => {
		expect(formatTimestamp(2.5)).toBe("00:02");
		expect(formatTimestamp(150.7)).toBe("02:30");
	});
});
