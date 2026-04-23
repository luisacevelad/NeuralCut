"use client";

import { cn } from "@/utils/ui";
import type { ChatMessage } from "@/agent/types";

interface MessageBubbleProps {
	message: ChatMessage;
}

const ROLE_LABELS: Record<ChatMessage["role"], string> = {
	user: "You",
	assistant: "Assistant",
	tool_result: "Tool",
};

export function MessageBubble({ message }: MessageBubbleProps) {
	const isUser = message.role === "user";

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
