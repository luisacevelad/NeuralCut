export type MentionKind = "asset" | "element";

export interface MentionItem {
	kind: MentionKind;
	ref: string;
	label: string;
	type: string;
	description?: string;
}

export interface MentionAttachment {
	kind: MentionKind;
	ref: string;
	label: string;
	data: Record<string, unknown>;
}

export interface ParsedMentions {
	cleanText: string;
	attachments: MentionAttachment[];
}
