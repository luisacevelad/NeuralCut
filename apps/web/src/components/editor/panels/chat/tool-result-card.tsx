"use client";

import { useState } from "react";
import { cn } from "@/utils/ui";
import { formatToolResult } from "./tool-formatters";

interface ToolResultCardProps {
	name: string;
	content: string;
}

export function ToolResultCard({ name, content }: ToolResultCardProps) {
	const [open, setOpen] = useState(false);
	const summary = formatToolResult(name, content);

	if (!summary) return null;

	return (
		<div className="group/result flex flex-col rounded-md border border-border/50 bg-muted/20 text-xs">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-muted/40"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 16 16"
					fill="currentColor"
					role="img"
					aria-label="Expand"
					className={cn(
						"size-3 shrink-0 text-muted-foreground transition-transform duration-200",
						open && "rotate-90",
					)}
				>
					<path
						fillRule="evenodd"
						d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z"
						clipRule="evenodd"
					/>
				</svg>
				<span className="font-medium text-foreground/80">{summary.label}</span>
				<span className="text-muted-foreground">{summary.description}</span>
			</button>
			{open && (
				<div className="border-border/50 border-t px-2.5 py-1.5">
					<pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-muted-foreground">
						{content}
					</pre>
				</div>
			)}
		</div>
	);
}
