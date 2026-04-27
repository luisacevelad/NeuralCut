"use client";

import { cn } from "@/utils/ui";
import type { ChatMessage, ToolCall } from "@/agent/types";
import { isTranscriptData, formatTimestamp } from "./transcript-utils";
import type { TranscriptData } from "./transcript-utils";
import {
	ToolExecutionCard,
	type ToolExecutionPair,
} from "./tool-execution-card";

interface MessageBubbleProps {
	message: ChatMessage;
	messages: ChatMessage[];
}

function buildToolCallPairs(messages: ChatMessage[]): ToolExecutionPair[] {
	const pairs: ToolExecutionPair[] = [];
	const resultIndex = new Map<string, string>();

	for (const msg of messages) {
		if (msg.role === "tool_result" && msg.toolCallId) {
			resultIndex.set(msg.toolCallId, msg.content);
		}
	}

	for (const msg of messages) {
		if (msg.role === "assistant" && msg.toolCalls) {
			for (const tc of msg.toolCalls) {
				pairs.push({
					toolCall: tc,
					resultContent: resultIndex.get(tc.id),
				});
			}
		}
	}

	return pairs;
}

function TranscriptCard({ data }: { data: TranscriptData }) {
	return (
		<div className="flex flex-col gap-2 rounded-md border bg-card p-3">
			<div className="flex items-center justify-between">
				<span className="text-sm font-medium">{data.assetName}</span>
				<span className="text-muted-foreground text-xs">
					{data.language} · {formatTimestamp(data.duration)}
				</span>
			</div>
			<p className="text-sm">{data.fullText}</p>
			<details className="text-xs">
				<summary className="text-muted-foreground cursor-pointer">
					{data.segments.length} segment{data.segments.length !== 1 && "s"}
				</summary>
				<div className="mt-1 flex flex-col gap-0.5">
					{data.segments.map((seg, i) => (
						<div key={i} className="text-muted-foreground">
							<span className="font-mono">[{formatTimestamp(seg.start)}]</span>{" "}
							{seg.text}
						</div>
					))}
				</div>
			</details>
		</div>
	);
}

function isToolResultAbsorbed(
	message: ChatMessage,
	allMessages: ChatMessage[],
): boolean {
	if (message.role !== "tool_result" || !message.toolCallId) return false;
	return allMessages.some(
		(m) =>
			m.role === "assistant" &&
			m.toolCalls?.some((tc: ToolCall) => tc.id === message.toolCallId),
	);
}

export function MessageBubble({ message, messages }: MessageBubbleProps) {
	const isUser = message.role === "user";

	if (message.role === "tool_result") {
		if (isToolResultAbsorbed(message, messages)) {
			return null;
		}

		try {
			const parsed = JSON.parse(message.content);
			if (isTranscriptData(parsed)) {
				return (
					<div className="px-3 py-0.5">
						<TranscriptCard data={parsed} />
					</div>
				);
			}
		} catch {}

		return null;
	}

	const hasToolCalls =
		message.role === "assistant" &&
		message.toolCalls &&
		message.toolCalls.length > 0;

	const toolPairs = hasToolCalls
		? message.toolCalls!.map((tc: ToolCall) => {
				const result = messages.find(
					(m) => m.role === "tool_result" && m.toolCallId === tc.id,
				);
				return {
					toolCall: tc,
					resultContent: result?.content,
				};
			})
		: [];

	return (
		<div
			className={cn(
				"flex flex-col gap-1.5 rounded-md px-3 py-2",
				isUser ? "bg-secondary" : "bg-transparent",
			)}
		>
			{message.content && (
				<p className="text-sm whitespace-pre-wrap">{message.content}</p>
			)}
			{toolPairs.length > 0 && (
				<div className="flex flex-col gap-1">
					{toolPairs.map((pair) => (
						<ToolExecutionCard key={pair.toolCall.id} pair={pair} />
					))}
				</div>
			)}
		</div>
	);
}
