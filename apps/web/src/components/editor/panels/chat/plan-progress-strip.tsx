"use client";

import { useEffect, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	CheckmarkCircle02Icon,
	CancelCircleIcon,
	Loading03Icon,
	MinusSignIcon,
} from "@hugeicons/core-free-icons";
import { usePlanStore } from "@/stores/plan-store";
import { cn } from "@/utils/ui";
import type { PlanStep, PlanStepStatus } from "@/agent/types";

const STATUS_ICON: Record<PlanStepStatus, typeof CheckmarkCircle02Icon> = {
	pending: MinusSignIcon,
	in_progress: Loading03Icon,
	done: CheckmarkCircle02Icon,
	skipped: CancelCircleIcon,
};

const STATUS_COLOR: Record<PlanStepStatus, string> = {
	pending: "text-muted-foreground",
	in_progress: "text-blue-400",
	done: "text-emerald-400",
	skipped: "text-muted-foreground/50",
};

function StepPill({ step, index }: { step: PlanStep; index: number }) {
	const isCurrent = step.status === "in_progress";

	return (
		<div
			className={cn(
				"flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] leading-tight whitespace-nowrap",
				isCurrent && "bg-primary/10",
				step.status === "skipped" && "opacity-40",
				step.status === "done" && "text-muted-foreground line-through",
			)}
		>
			<HugeiconsIcon
				icon={STATUS_ICON[step.status]}
				className={cn(
					"size-3 shrink-0",
					STATUS_COLOR[step.status],
					step.status === "in_progress" && "animate-spin",
				)}
				strokeWidth={2}
			/>
			<span className="text-muted-foreground w-3 shrink-0 text-right tabular-nums">
				{index + 1}
			</span>
			<span className="truncate">{step.description}</span>
		</div>
	);
}

export function PlanProgressStrip() {
	const plan = usePlanStore((s) => s.plan);
	const scrollRef = useRef<HTMLDivElement>(null);

	const activeIndex = plan?.steps.findIndex((s) => s.status === "in_progress") ?? -1;

	useEffect(() => {
		if (!scrollRef.current || activeIndex < 0) return;
		const container = scrollRef.current;
		const activeChild = container.children[activeIndex] as HTMLElement | undefined;
		if (!activeChild) return;

		const containerRect = container.getBoundingClientRect();
		const childRect = activeChild.getBoundingClientRect();

		const offset =
			childRect.top - containerRect.top - containerRect.height / 2 + childRect.height / 2;

		container.scrollTop += offset;
	}, [activeIndex]);

	if (!plan) return null;

	const doneCount = plan.steps.filter((s) => s.status === "done").length;
	const totalCount = plan.steps.length;
	const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

	return (
		<div className="flex gap-2 border-t border-border/50 pt-2 mt-2">
			<div className="flex flex-col items-center gap-0.5 pt-0.5">
				<span className="text-muted-foreground text-[9px] tabular-nums font-medium">
					{doneCount}/{totalCount}
				</span>
				<div className="bg-muted w-1.5 flex-1 overflow-hidden rounded-full">
					<div
						className="bg-emerald-400 w-full rounded-full transition-all duration-300"
						style={{ height: `${progress}%` }}
					/>
				</div>
			</div>
			<div
				ref={scrollRef}
				className="scrollbar-thin max-h-[72px] flex-1 overflow-y-auto scroll-smooth"
			>
				{plan.steps.map((step, i) => (
					<StepPill key={step.id} step={step} index={i} />
				))}
			</div>
		</div>
	);
}
