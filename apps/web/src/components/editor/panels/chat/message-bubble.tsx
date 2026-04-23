"use client";

import { cn } from "@/utils/ui";
import type { ChatMessage } from "@/agent/types";
import {
	isTranscriptData,
	formatTimestamp,
} from "./transcript-utils";
import type { TranscriptData } from "./transcript-utils";

interface MessageBubbleProps {
	message: ChatMessage;
}

const ROLE_LABELS: Record<ChatMessage["role"], string> = {
	user: "You",
	assistant: "Assistant",
	tool_result: "Tool",
	system: "System",
};

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

export function MessageBubble({ message }: MessageBubbleProps) {
	const isUser = message.role === "user";

	// For tool_result messages, try to parse as transcript
	if (message.role === "tool_result") {
		try {
			const parsed = JSON.parse(message.content);
			if (isTranscriptData(parsed)) {
				return (
					<div className="flex flex-col gap-1 rounded-md px-3 py-2">
						<span className="text-muted-foreground text-xs font-medium">
							{ROLE_LABELS.tool_result}
						</span>
						<TranscriptCard data={parsed} />
					</div>
				);
			}
		} catch {
			// Not JSON — fall through to plain text
		}
	}

	return (
		<div
			className={cn(
				"flex flex-col gap-1 rounded-md px-3 py-2",
				isUser ? "bg-secondary" : "bg-transparent",
			)}
		>
			<span className="text-muted-foreground text-xs font-medium">
				{ROLE_LABELS[message.role]}
			</span>
			<p className="text-sm whitespace-pre-wrap">{message.content}</p>
		</div>
	);
}
