"use client";

import { Fragment } from "react";

const MENTION_PATTERN = /\B@[\w.-]+/g;

export function renderMessageWithMentions(content: string) {
	const parts: Array<{ key: string; type: "text" | "mention"; value: string }> =
		[];
	let lastIndex = 0;
	let partCounter = 0;

	for (const match of content.matchAll(MENTION_PATTERN)) {
		const idx = match.index;
		if (idx > lastIndex) {
			parts.push({
				key: `t-${partCounter++}`,
				type: "text",
				value: content.slice(lastIndex, idx),
			});
		}
		parts.push({
			key: `m-${match[0]}`,
			type: "mention",
			value: match[0],
		});
		lastIndex = idx + match[0].length;
	}

	if (lastIndex < content.length) {
		parts.push({
			key: `t-${partCounter++}`,
			type: "text",
			value: content.slice(lastIndex),
		});
	}

	if (parts.length === 0) {
		return <>{content}</>;
	}

	return (
		<>
			{parts.map((part) =>
				part.type === "mention" ? (
					<span
						key={part.key}
						className="bg-primary/15 text-primary inline-flex items-center rounded px-1 py-0.5 text-xs font-medium"
					>
						{part.value}
					</span>
				) : (
					<Fragment key={part.key}>{part.value}</Fragment>
				),
			)}
		</>
	);
}
