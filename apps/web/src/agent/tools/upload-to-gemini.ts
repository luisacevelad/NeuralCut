export type UploadedGeminiFile = {
	provider: "gemini";
	status: "loaded" | "processing";
	fileName?: string;
	fileUri: string;
	mimeType: string;
	displayName?: string;
};

export async function uploadFileToGemini({
	file,
	displayName,
	mimeType,
}: {
	file: File;
	displayName: string;
	mimeType: string;
}): Promise<UploadedGeminiFile | { error: string }> {
	const formData = new FormData();
	formData.set("file", file);
	formData.set("displayName", displayName);
	formData.set("mimeType", mimeType);

	const response = await fetch("/api/agent/context/load", {
		method: "POST",
		body: formData,
	});

	const data = (await response.json()) as Partial<UploadedGeminiFile> & {
		error?: string;
	};

	if (!response.ok) {
		return { error: data.error ?? "Failed to load context" };
	}

	if (!data.fileUri || !data.mimeType || !data.status) {
		return { error: "Invalid context load response" };
	}

	return {
		provider: "gemini",
		status: data.status,
		fileName: data.fileName,
		fileUri: data.fileUri,
		mimeType: data.mimeType,
		displayName: data.displayName,
	};
}
