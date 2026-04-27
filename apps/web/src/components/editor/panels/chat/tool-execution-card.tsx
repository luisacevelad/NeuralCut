"use client";

import { useState } from "react";
import { cn } from "@/utils/ui";
import { formatToolCall, formatToolResult } from "./tool-formatters";
import type { ToolCall } from "@/agent/types";

export interface ToolExecutionPair {
	toolCall: ToolCall;
	resultContent?: string;
}

interface ToolExecutionCardProps {
	pair: ToolExecutionPair;
}

type Status = "pending" | "success" | "error";

function getStatus(resultContent?: string): Status {
	if (resultContent === undefined) return "pending";
	try {
		const parsed = JSON.parse(resultContent);
		if (parsed && typeof parsed === "object" && "error" in parsed) return "error";
	} catch {}
	return "success";
}

function StatusIcon({ status }: { status: Status }) {
	if (status === "pending") {
		return (
			<svg
				className="size-3 shrink-0 animate-spin text-muted-foreground"
				viewBox="0 0 24 24"
				fill="none"
			>
				<circle
					cx="12"
					cy="12"
					r="10"
					stroke="currentColor"
					strokeWidth="3"
					className="opacity-25"
				/>
				<path
					d="M4 12a8 8 0 018-8"
					stroke="currentColor"
					strokeWidth="3"
					strokeLinecap="round"
				/>
			</svg>
		);
	}

	if (status === "error") {
		return (
			<svg
				className="size-3 shrink-0 text-destructive"
				viewBox="0 0 16 16"
				fill="currentColor"
			>
				<path
					fillRule="evenodd"
					d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm2.78-4.22a.75.75 0 0 1-1.06 0L8 9.06l-1.72 1.72a.75.75 0 1 1-1.06-1.06L6.94 8 5.22 6.28a.75.75 0 0 1 1.06-1.06L8 6.94l1.72-1.72a.75.75 0 1 1 1.06 1.06L9.06 8l1.72 1.72a.75.75 0 0 1 0 1.06Z"
					clipRule="evenodd"
				/>
			</svg>
		);
	}

	return (
		<svg
			className="size-3 shrink-0 text-emerald-500"
			viewBox="0 0 16 16"
			fill="currentColor"
		>
			<path
				fillRule="evenodd"
				d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm3.844-8.791a.75.75 0 0 0-1.188-.918l-3.7 4.79-1.649-1.833a.75.75 0 1 0-1.114 1.004l2.25 2.5a.75.75 0 0 0 1.15-.043l4.25-5.5Z"
				clipRule="evenodd"
			/>
		</svg>
	);
}

export function ToolExecutionCard({ pair }: ToolExecutionCardProps) {
	const { toolCall, resultContent } = pair;
	const [open, setOpen] = useState(false);
	const status = getStatus(resultContent);

	const callSummary = formatToolCall(toolCall.name, toolCall.args);
	const resultSummary = resultContent
		? formatToolResult(toolCall.name, resultContent)
		: null;

	const hasResult =
		status === "success" && resultContent !== undefined && resultContent !== "{}";

	return (
		<div
			className={cn(
				"group/tool flex flex-col rounded-md border text-xs transition-colors",
				status === "error"
					? "border-destructive/30 bg-destructive/5"
					: "border-border/50 bg-muted/30",
			)}
		>
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-muted/50"
			>
				<StatusIcon status={status} />
				<span className="font-medium text-foreground/80">
					{callSummary.label}
				</span>
				<span className="text-muted-foreground truncate">
					{status === "error"
						? "Failed"
						: resultSummary
							? resultSummary.description
							: callSummary.description}
				</span>
			</button>
			{open && (
				<div className="border-border/50 border-t px-2.5 py-1.5 flex flex-col gap-2">
					<div>
						<span className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">
							Params
						</span>
						<pre className="mt-0.5 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-muted-foreground">
							{JSON.stringify(toolCall.args, null, 2)}
						</pre>
					</div>
					{status === "error" && resultContent && (
						<div>
							<span className="text-destructive text-[10px] uppercase tracking-wider font-medium">
								Error
							</span>
							<pre className="mt-0.5 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-destructive/80">
								{resultContent}
							</pre>
						</div>
					)}
					{hasResult && status === "success" && (
						<div>
							<span className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">
								Output
							</span>
							<pre className="mt-0.5 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-muted-foreground">
								{(() => {
									try {
										return JSON.stringify(JSON.parse(resultContent!), null, 2);
									} catch {
										return resultContent;
									}
								})()}
							</pre>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
