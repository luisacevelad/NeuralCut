"use client";

import { useCallback } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Shield01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { formatToolCall } from "./tool-formatters";
import { useAgentStore } from "@/stores/agent-store";
import type { PendingToolApproval } from "@/stores/agent-store";

interface ToolPermissionRequestProps {
	pending: PendingToolApproval;
}

export function ToolPermissionRequest({ pending }: ToolPermissionRequestProps) {
	const { toolCall, resolve } = pending;
	const summary = formatToolCall(toolCall.name, toolCall.args);

	const handleAllow = useCallback(() => {
		useAgentStore.getState().setPendingApproval(null);
		resolve(true);
	}, [resolve]);

	const handleDeny = useCallback(() => {
		useAgentStore.getState().setPendingApproval(null);
		resolve(false);
	}, [resolve]);

	return (
		<div className="flex flex-col gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
			<div className="flex items-center gap-2">
				<HugeiconsIcon
					icon={Shield01Icon}
					className="size-4 shrink-0 text-amber-500"
					strokeWidth={1.5}
				/>
				<span className="text-xs font-medium text-amber-600">
					Permission Request
				</span>
			</div>
			<div className="text-xs">
				<span className="font-medium text-foreground/80">{summary.label}</span>
				<span className="text-muted-foreground"> — {summary.description}</span>
			</div>
			{Object.keys(toolCall.args).length > 0 && (
				<pre className="max-h-32 overflow-auto rounded bg-muted/50 px-2 py-1 font-mono text-[11px] text-muted-foreground">
					{JSON.stringify(toolCall.args, null, 2)}
				</pre>
			)}
			<div className="flex items-center gap-2">
				<Button
					variant="default"
					size="sm"
					onClick={handleAllow}
					className="text-xs"
				>
					Allow
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={handleDeny}
					className="text-xs"
				>
					<HugeiconsIcon
						icon={Cancel01Icon}
						className="mr-1 size-3"
						strokeWidth={2}
					/>
					Deny
				</Button>
			</div>
		</div>
	);
}
