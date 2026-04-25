"use client";

import { cn } from "@/utils/ui";
import type { ChatMessage, ToolCall } from "@/agent/types";
import { isTranscriptData, formatTimestamp } from "./transcript-utils";
import type { TranscriptData } from "./transcript-utils";
import { ToolCallCard } from "./tool-call-card";
import { ToolResultCard } from "./tool-result-card";

interface MessageBubbleProps {
	message: ChatMessage;
	messages: ChatMessage[];
}

function findToolCallName(
	messages: ChatMessage[],
	toolCallId?: string,
): string | null {
	if (!toolCallId) return null;
	for (const msg of messages) {
		if (msg.role === "assistant" && msg.toolCalls) {
			const match = msg.toolCalls.find((tc: ToolCall) => tc.id === toolCallId);
			if (match) return match.name;
		}
	}
	return null;
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

export function MessageBubble({ message, messages }: MessageBubbleProps) {
	const isUser = message.role === "user";

	if (message.role === "tool_result") {
		const toolName = findToolCallName(messages, message.toolCallId);

		try {
			const parsed = JSON.parse(message.content);
			if (isTranscriptData(parsed)) {
				return (
					<div className="px-3 py-0.5">
						<TranscriptCard data={parsed} />
					</div>
				);
			}
		} catch {
			// not JSON
		}

		if (toolName) {
			return (
				<div className="px-3 py-0.5">
					<ToolResultCard name={toolName} content={message.content} />
				</div>
			);
		}

		return (
			<div className="px-3 py-0.5">
				<ToolResultCard name="Tool" content={message.content} />
			</div>
		);
	}

	const hasToolCalls =
		message.role === "assistant" &&
		message.toolCalls &&
		message.toolCalls.length > 0;

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
			{hasToolCalls && (
				<div className="flex flex-col gap-1">
					{message.toolCalls?.map((tc: ToolCall) => (
						<ToolCallCard key={tc.id} toolCall={tc} />
					))}
				</div>
			)}
		</div>
	);
}
