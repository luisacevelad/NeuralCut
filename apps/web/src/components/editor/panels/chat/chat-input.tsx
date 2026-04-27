"use client";

import { useState, useCallback, type KeyboardEvent } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Sent02Icon,
	FlashIcon,
	Shield01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAgentStore, type PermissionMode } from "@/stores/agent-store";
import { cn } from "@/utils/ui";

interface ChatInputProps {
	onSend: (content: string) => void;
	disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
	const [value, setValue] = useState("");
	const permissionMode = useAgentStore((s) => s.permissionMode);
	const setPermissionMode = useAgentStore((s) => s.setPermissionMode);
	const pendingApproval = useAgentStore((s) => s.pendingApproval);

	const handleSend = useCallback(() => {
		const trimmed = value.trim();
		if (!trimmed || disabled) return;
		onSend(trimmed);
		setValue("");
	}, [value, disabled, onSend]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				handleSend();
			}
		},
		[handleSend],
	);

	const toggleMode = useCallback(() => {
		const next: PermissionMode =
			permissionMode === "skip" ? "ask" : "skip";
		setPermissionMode(next);
	}, [permissionMode, setPermissionMode]);

	const isAsk = permissionMode === "ask";

	return (
		<div className="border-t p-3">
			<div className="flex items-end gap-2">
				<textarea
					value={value}
					onChange={(e) => setValue(e.target.value)}
					onKeyDown={handleKeyDown}
					disabled={disabled}
					placeholder="Ask the assistant..."
					rows={1}
					className="border-border bg-input focus-visible:border-primary/50 focus-visible:ring-primary/20 flex-1 resize-none rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
				/>
				<Button
					variant={isAsk ? "default" : "secondary"}
					size="icon"
					onClick={toggleMode}
					disabled={!!pendingApproval}
					aria-label={isAsk ? "Ask permissions" : "Skip permissions"}
					title={isAsk ? "Ask permissions" : "Skip permissions"}
				>
					<HugeiconsIcon
						icon={isAsk ? Shield01Icon : FlashIcon}
						className={cn("size-4", isAsk && "text-amber-300")}
						strokeWidth={1.5}
					/>
				</Button>
				<Button
					variant="secondary"
					size="icon"
					onClick={handleSend}
					disabled={disabled || !value.trim()}
					aria-label="Send message"
				>
					{disabled ? (
						<Spinner className="size-4" />
					) : (
						<HugeiconsIcon icon={Sent02Icon} className="size-4" />
					)}
				</Button>
			</div>
		</div>
	);
}
