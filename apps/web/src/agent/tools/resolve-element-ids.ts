export function resolveElementIds(raw: unknown): string[] | null {
	if (Array.isArray(raw)) {
		const ids = raw.filter(
			(id) => typeof id === "string" && id.trim().length > 0,
		);
		return ids.length > 0 ? ids : null;
	}

	if (typeof raw === "string" && raw.trim().length > 0) {
		const ids = raw
			.split(",")
			.map((id) => id.trim())
			.filter((id) => id.length > 0);
		return ids.length > 0 ? ids : null;
	}

	return null;
}
