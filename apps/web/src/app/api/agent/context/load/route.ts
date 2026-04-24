import { type NextRequest, NextResponse } from "next/server";
import { FileState, GoogleAIFileManager } from "@google/generative-ai/server";

const MAX_PROCESSING_POLLS = 12;
const PROCESSING_POLL_INTERVAL_MS = 5000;

export async function POST(request: NextRequest) {
	const apiKey = process.env.GEMINI_API_KEY ?? process.env.LLM_API_KEY;
	if (!apiKey) {
		return NextResponse.json(
			{
				error:
					"Server configuration error: missing GEMINI_API_KEY or LLM_API_KEY",
			},
			{ status: 502 },
		);
	}

	const formData = await request.formData();
	const file = formData.get("file");
	const displayName = formData.get("displayName");
	const requestedMimeType = formData.get("mimeType");

	if (!(file instanceof File)) {
		return NextResponse.json({ error: "File is required" }, { status: 400 });
	}

	try {
		const mimeType = resolveGeminiMimeType({
			fileName: file.name,
			fileType: file.type,
			displayName: typeof displayName === "string" ? displayName : undefined,
			requestedMimeType:
				typeof requestedMimeType === "string" ? requestedMimeType : undefined,
		});

		if (!mimeType) {
			return NextResponse.json(
				{ error: "Unsupported MIME type" },
				{ status: 400 },
			);
		}

		const fileManager = new GoogleAIFileManager(apiKey);
		const uploadResult = await fileManager.uploadFile(
			Buffer.from(await file.arrayBuffer()),
			{
				mimeType,
				displayName:
					typeof displayName === "string" && displayName
						? displayName
						: file.name,
			},
		);

		let uploadedFile = uploadResult.file;
		for (let i = 0; i < MAX_PROCESSING_POLLS; i++) {
			if (uploadedFile.state !== FileState.PROCESSING) {
				break;
			}

			await wait(PROCESSING_POLL_INTERVAL_MS);
			uploadedFile = await fileManager.getFile(uploadedFile.name);
		}

		if (uploadedFile.state === FileState.FAILED) {
			return NextResponse.json(
				{ error: "Failed to load context" },
				{ status: 502 },
			);
		}

		return NextResponse.json({
			provider: "gemini",
			status:
				uploadedFile.state === FileState.PROCESSING ? "processing" : "loaded",
			fileName: uploadedFile.name,
			fileUri: uploadedFile.uri,
			mimeType: uploadedFile.mimeType || mimeType,
			displayName: uploadedFile.displayName,
		});
	} catch (error) {
		console.error("[agent/context/load] Gemini upload error:", error);
		return NextResponse.json(
			{ error: "Failed to load context" },
			{ status: 502 },
		);
	}
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveGeminiMimeType({
	fileName,
	fileType,
	displayName,
	requestedMimeType,
}: {
	fileName: string;
	fileType?: string;
	displayName?: string;
	requestedMimeType?: string;
}): string | null {
	for (const candidate of [requestedMimeType, fileType]) {
		if (candidate && candidate !== "application/octet-stream") {
			return candidate;
		}
	}

	const mimeType = inferMimeTypeFromName(displayName) ?? inferMimeTypeFromName(fileName);
	return mimeType ?? null;
}

function inferMimeTypeFromName(name?: string): string | null {
	const extension = name?.split(".").pop()?.toLowerCase();
	return extension ? (MIME_BY_EXTENSION[extension] ?? null) : null;
}

const MIME_BY_EXTENSION: Record<string, string> = {
	avi: "video/x-msvideo",
	flac: "audio/flac",
	gif: "image/gif",
	jpeg: "image/jpeg",
	jpg: "image/jpeg",
	m4a: "audio/mp4",
	mov: "video/quicktime",
	mp3: "audio/mpeg",
	mp4: "video/mp4",
	mpeg: "video/mpeg",
	mpg: "video/mpeg",
	png: "image/png",
	wav: "audio/wav",
	webm: "video/webm",
	webp: "image/webp",
};
