"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { MentionItem } from "@/lib/mentions/types";
import { filterCandidates } from "@/lib/mentions/parser";
import { cn } from "@/utils/ui";

interface MentionPopoverProps {
	candidates: MentionItem[];
	query: string;
	open: boolean;
	anchorRect: DOMRect | null;
	onSelect: (item: MentionItem) => void;
	onClose: () => void;
}

export function MentionPopover({
	candidates,
	query,
	open,
	anchorRect,
	onSelect,
	onClose,
}: MentionPopoverProps) {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const listRef = useRef<HTMLDivElement>(null);
	const filtered = filterCandidates(candidates, query);

	const prevQueryRef = useRef(query);
	if (prevQueryRef.current !== query) {
		prevQueryRef.current = query;
		setSelectedIndex(0);
	}

	useEffect(() => {
		if (!open) return;
		setSelectedIndex(0);
	}, [open]);

	const scrollIntoView = useCallback((index: number) => {
		const el = listRef.current?.children[index] as HTMLElement | undefined;
		el?.scrollIntoView({ block: "nearest" });
	}, []);

	useEffect(() => {
		scrollIntoView(selectedIndex);
	}, [selectedIndex, scrollIntoView]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (!open || filtered.length === 0) return;

			if (e.key === "ArrowDown") {
				e.preventDefault();
				setSelectedIndex((i) => (i + 1) % filtered.length);
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
			} else if (e.key === "Enter" || e.key === "Tab") {
				e.preventDefault();
				onSelect(filtered[selectedIndex]);
			} else if (e.key === "Escape") {
				e.preventDefault();
				onClose();
			}
		},
		[open, filtered, selectedIndex, onSelect, onClose],
	);

	useEffect(() => {
		if (!open) return;
		document.addEventListener("keydown", handleKeyDown, true);
		return () => document.removeEventListener("keydown", handleKeyDown, true);
	}, [handleKeyDown, open]);

	if (!open || filtered.length === 0 || !anchorRect) return null;

	return (
		<div
			className="bg-popover text-popover-foreground fixed z-50 max-h-56 w-64 overflow-auto rounded-md border shadow-md"
			style={{
				left: anchorRect.left,
				top: anchorRect.bottom + 4,
			}}
		>
			<div ref={listRef} className="flex flex-col py-1">
				{filtered.map((item, i) => (
					<button
						key={`${item.kind}-${item.ref}`}
						type="button"
						className={cn(
							"flex flex-col items-start gap-0.5 px-3 py-1.5 text-left text-sm transition-colors",
							i === selectedIndex
								? "bg-accent text-accent-foreground"
								: "hover:bg-accent/50",
						)}
						onClick={() => onSelect(item)}
						onMouseEnter={() => setSelectedIndex(i)}
					>
						<span className="flex items-center gap-1.5">
							<TypeIcon type={item.type} />
							<span className="font-medium">{item.label}</span>
						</span>
						<span className="text-muted-foreground text-xs">
							{item.description ?? item.ref}
						</span>
					</button>
				))}
			</div>
		</div>
	);
}

function TypeIcon({ type }: { type: string }) {
	const color =
		type === "video"
			? "bg-blue-500"
			: type === "audio"
				? "bg-green-500"
				: type === "image"
					? "bg-purple-500"
					: type === "text"
						? "bg-amber-500"
						: type === "effect"
							? "bg-pink-500"
							: "bg-muted-foreground";

	return (
		<span
			className={`inline-block size-2 rounded-full ${color}`}
			aria-hidden="true"
		/>
	);
}
