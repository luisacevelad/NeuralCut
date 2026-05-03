"use client";

import { useState, useCallback } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Add01Icon,
	ArrowDown01Icon,
	MoreHorizontalCircleIcon,
	Delete01Icon,
	Edit02Icon,
	CheckmarkCircle02Icon,
	Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverTrigger,
	PopoverContent,
} from "@/components/ui/popover";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatStore } from "@/stores/chat-store";
import { cn } from "@/utils/ui";

export function SessionHeader() {
	const activeSessionId = useChatStore((s) => s.activeSessionId);
	const sessions = useChatStore((s) => s.sessions);
	const createSession = useChatStore((s) => s.createSession);
	const [sessionListOpen, setSessionListOpen] = useState(false);

	const activeSession = sessions.find((s) => s.id === activeSessionId);

	const handleNewChat = useCallback(async () => {
		await createSession();
		setSessionListOpen(false);
	}, [createSession]);

	return (
		<div className="border-b px-3 py-2">
			<div className="flex items-center gap-2">
				<Popover open={sessionListOpen} onOpenChange={setSessionListOpen}>
					<PopoverTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className="flex-1 justify-start gap-2 px-2 text-sm font-normal"
						>
							<span className="truncate">
								{activeSession?.title ?? "New chat"}
							</span>
							<HugeiconsIcon
								icon={ArrowDown01Icon}
								className="text-muted-foreground ml-auto size-3.5 shrink-0"
								strokeWidth={2}
							/>
						</Button>
					</PopoverTrigger>
					<PopoverContent
						align="start"
						className="w-64 p-1"
						onCloseAutoFocus={(e) => e.preventDefault()}
					>
						<SessionList onClose={() => setSessionListOpen(false)} />
					</PopoverContent>
				</Popover>

				<Button
					variant="ghost"
					size="icon"
					className="size-7 shrink-0"
					onClick={handleNewChat}
					title="New chat"
				>
					<HugeiconsIcon icon={Add01Icon} className="size-4" strokeWidth={2} />
				</Button>
			</div>
		</div>
	);
}

function SessionList({ onClose }: { onClose: () => void }) {
	const sessions = useChatStore((s) => s.sessions);
	const activeSessionId = useChatStore((s) => s.activeSessionId);
	const switchSession = useChatStore((s) => s.switchSession);
	const deleteSession = useChatStore((s) => s.deleteSession);
	const renameSession = useChatStore((s) => s.renameSession);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editValue, setEditValue] = useState("");

	const handleSwitch = useCallback(
		async (id: string) => {
			await switchSession(id);
			onClose();
		},
		[switchSession, onClose],
	);

	const startRename = useCallback((session: { id: string; title: string }) => {
		setEditingId(session.id);
		setEditValue(session.title);
	}, []);

	const confirmRename = useCallback(async () => {
		if (editingId && editValue.trim()) {
			await renameSession(editingId, editValue.trim());
		}
		setEditingId(null);
	}, [editingId, editValue, renameSession]);

	const cancelRename = useCallback(() => {
		setEditingId(null);
	}, []);

	const handleDelete = useCallback(
		async (id: string) => {
			await deleteSession(id);
		},
		[deleteSession],
	);

	if (sessions.length === 0) {
		return (
			<div className="text-muted-foreground px-3 py-6 text-center text-xs">
				No sessions yet
			</div>
		);
	}

	return (
		<ScrollArea className="max-h-64">
			<div className="flex flex-col gap-0.5">
				{sessions.map((session) => (
					<div
						key={session.id}
						className={cn(
							"group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm",
							session.id === activeSessionId
								? "bg-accent text-accent-foreground"
								: "hover:bg-accent/50 cursor-pointer",
						)}
						onClick={() => {
							if (editingId !== session.id) {
								handleSwitch(session.id);
							}
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter" && editingId === session.id) {
								confirmRename();
							}
						}}
					>
						{editingId === session.id ? (
							<div className="flex flex-1 items-center gap-1">
								<Input
									value={editValue}
									onChange={(e) => setEditValue(e.target.value)}
									onKeyDown={(e) => {
										e.stopPropagation();
										if (e.key === "Enter") confirmRename();
										if (e.key === "Escape") cancelRename();
									}}
									onClick={(e) => e.stopPropagation()}
									className="h-6 flex-1 text-xs"
									autoFocus
								/>
								<Button
									variant="ghost"
									size="icon"
									className="size-5 shrink-0"
									onClick={(e) => {
										e.stopPropagation();
										confirmRename();
									}}
								>
									<HugeiconsIcon
										icon={CheckmarkCircle02Icon}
										className="size-3.5"
										strokeWidth={2}
									/>
								</Button>
								<Button
									variant="ghost"
									size="icon"
									className="size-5 shrink-0"
									onClick={(e) => {
										e.stopPropagation();
										cancelRename();
									}}
								>
									<HugeiconsIcon
										icon={Cancel01Icon}
										className="size-3.5"
										strokeWidth={2}
									/>
								</Button>
							</div>
						) : (
							<>
								<span className="flex-1 truncate text-xs">
									{session.title}
								</span>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="size-5 shrink-0 opacity-0 group-hover:opacity-100"
											onClick={(e) => e.stopPropagation()}
										>
											<HugeiconsIcon
												icon={MoreHorizontalCircleIcon}
												className="size-3.5"
												strokeWidth={2}
											/>
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end" className="w-36">
										<DropdownMenuItem
											onClick={(e) => {
												e.stopPropagation();
												startRename(session);
											}}
										>
											<HugeiconsIcon
												icon={Edit02Icon}
												className="mr-2 size-3.5"
												strokeWidth={2}
											/>
											Rename
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={(e) => {
												e.stopPropagation();
												handleDelete(session.id);
											}}
											className="text-destructive focus:text-destructive"
										>
								<HugeiconsIcon
									icon={Delete01Icon}
									className="mr-2 size-3.5"
									strokeWidth={2}
								/>
											Delete
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</>
						)}
					</div>
				))}
			</div>
		</ScrollArea>
	);
}
