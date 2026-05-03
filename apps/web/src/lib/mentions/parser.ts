import type { AgentContext } from "@/agent/types";
import { resolveAsset, resolveElement } from "@/agent/ref-resolver";
import { EditorContextAdapter } from "@/agent/context";
import type { MentionAttachment, MentionItem, ParsedMentions } from "./types";

const MENTION_REGEX = /@\[([^\]]+)\]/g;

export function getCandidateMentions(context: AgentContext): MentionItem[] {
	const items: MentionItem[] = [];

	for (const asset of context.mediaAssets) {
		items.push({
			kind: "asset",
			ref: asset.id,
			label: asset.name,
			type: asset.type,
			description: `${asset.type} · ${asset.duration.toFixed(1)}s`,
		});
	}

	const tracks = context.timelineTracks ?? [];
	for (const track of tracks) {
		for (const element of track.elements) {
			items.push({
				kind: "element",
				ref: element.ref,
				label: element.displayName,
				type: element.type,
				description: `${element.type} · ${track.trackLabel} · ${element.start.toFixed(1)}s–${element.end.toFixed(1)}s`,
			});
		}
	}

	return items;
}

export function filterCandidates(
	candidates: MentionItem[],
	query: string,
): MentionItem[] {
	if (!query) return candidates.slice(0, 20);
	const lower = query.toLowerCase();
	return candidates
		.filter(
			(c) =>
				c.label.toLowerCase().includes(lower) ||
				c.ref.toLowerCase().includes(lower) ||
				c.type.toLowerCase().includes(lower),
		)
		.slice(0, 20);
}

export function insertMentionSyntax(
	text: string,
	mention: MentionItem,
	cursorPosition: number,
): { newText: string; newCursorPos: number } {
	const before = text.slice(0, cursorPosition);
	const after = text.slice(cursorPosition);

	const atIdx = before.lastIndexOf("@");
	if (atIdx === -1) {
		return { newText: text, newCursorPos: cursorPosition };
	}

	const prefix = before.slice(0, atIdx);
	const inserted = `@[${mention.ref}]`;
	const newText = `${prefix}${inserted} ${after}`;
	const newCursorPos = prefix.length + inserted.length + 1;

	return { newText, newCursorPos };
}

export function parseAndResolveMentions(
	text: string,
	context: AgentContext,
): ParsedMentions {
	const mentions = Array.from(text.matchAll(MENTION_REGEX));
	if (mentions.length === 0) {
		return { cleanText: text, attachments: [] };
	}

	const seen = new Set<string>();
	const attachments: MentionAttachment[] = [];

	for (const match of mentions) {
		const target = match[1];
		if (seen.has(target)) continue;
		seen.add(target);

		const attachment = resolveMention(target, context);
		if (attachment) {
			attachments.push(attachment);
		}
	}

	let cleanText = text;
	for (const match of mentions) {
		cleanText = cleanText.replace(match[0], `@${match[1]}`);
	}

	return { cleanText, attachments };
}

function resolveMention(
	target: string,
	context: AgentContext,
): MentionAttachment | null {
	const elementResult = resolveElement(target, context);
	if (!("error" in elementResult)) {
		const data = EditorContextAdapter.getElement({
			elementId: elementResult.elementId,
		});
		if ("error" in data) return null;

		return {
			kind: "element",
			ref: elementResult.ref,
			label:
				(data.name as string) ??
				(data.assetName as string) ??
				elementResult.ref,
			data,
		};
	}

	const assetResult = resolveAsset(target, context);
	if (!("error" in assetResult)) {
		return {
			kind: "asset",
			ref: assetResult.assetId,
			label: assetResult.assetName,
			data: {
				assetId: assetResult.assetId,
				assetName: assetResult.assetName,
			},
		};
	}

	return null;
}

export function buildInjectedContent(
	cleanText: string,
	attachments: MentionAttachment[],
): string {
	if (attachments.length === 0) return cleanText;

	const sections = attachments.map((att) => {
		const header =
			att.kind === "element"
				? `[Referenced element: ${att.ref}]`
				: `[Referenced asset: ${att.label}]`;
		const data = JSON.stringify(att.data, null, 2);
		return `${header}\n${data}`;
	});

	return `${sections.join("\n\n")}\n\n${cleanText}`;
}
