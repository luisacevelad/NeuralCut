import {
	Input,
	ALL_FORMATS,
	BlobSource,
	CanvasSink,
	AudioBufferSink,
	Output,
	Mp4OutputFormat,
	BufferTarget,
	CanvasSource,
	AudioBufferSource,
	QUALITY_LOW,
} from "mediabunny";

export const COMPRESS_THRESHOLD = 100 * 1024 * 1024;

export type CompressVideoOptions = {
	targetFps?: number;
	maxWidth?: number;
	maxHeight?: number;
};

const DEFAULT_OPTIONS: Required<CompressVideoOptions> = {
	targetFps: 2,
	maxWidth: 854,
	maxHeight: 480,
};

export function shouldCompressVideo(file: File): boolean {
	return file.type.startsWith("video/") && file.size > COMPRESS_THRESHOLD;
}

export async function compressVideoForContext(
	file: File,
	options?: CompressVideoOptions,
): Promise<File> {
	const { targetFps, maxWidth, maxHeight } = {
		...DEFAULT_OPTIONS,
		...options,
	};

	const input = new Input({
		source: new BlobSource(file),
		formats: ALL_FORMATS,
	});

	try {
		const duration = await input.computeDuration();
		const videoTrack = await input.getPrimaryVideoTrack();
		if (!videoTrack) throw new Error("No video track found");

		const canDecode = await videoTrack.canDecode();
		if (!canDecode) throw new Error("Cannot decode video");

		const frameInterval = 1 / targetFps;
		const frameCount = Math.ceil(duration * targetFps);
		const timestamps: number[] = [];
		for (let i = 0; i < frameCount; i++) {
			timestamps.push(i * frameInterval);
		}

		const sink = new CanvasSink(videoTrack, {
			width: maxWidth,
			height: maxHeight,
			fit: "contain",
			poolSize: 3,
		});

		const outputCanvas = document.createElement("canvas");
		outputCanvas.width = maxWidth;
		outputCanvas.height = maxHeight;
		const ctx = outputCanvas.getContext("2d");
	if (!ctx) throw new Error("Could not get canvas context");

		const output = new Output({
			format: new Mp4OutputFormat(),
			target: new BufferTarget(),
		});

		const videoSource = new CanvasSource(outputCanvas, {
			codec: "avc",
			bitrate: QUALITY_LOW,
		});

		output.addVideoTrack(videoSource, { frameRate: targetFps });

		const audioTrack = await input.getPrimaryAudioTrack();
		let audioSource: AudioBufferSource | null = null;

		if (audioTrack) {
			let audioCodec: "aac" | "opus" = "aac";

			if (typeof AudioEncoder !== "undefined") {
				const { supported } = await AudioEncoder.isConfigSupported({
					codec: "mp4a.40.2",
					sampleRate: 44100,
					numberOfChannels: 2,
					bitrate: 64000,
				});
				if (!supported) audioCodec = "opus";
			}

			audioSource = new AudioBufferSource({
				codec: audioCodec,
				bitrate: QUALITY_LOW,
			});
			output.addAudioTrack(audioSource);
		}

		await output.start();

		if (audioSource && audioTrack) {
			const audioSink = new AudioBufferSink(audioTrack);
			for await (const { buffer } of audioSink.buffers(0)) {
				await audioSource.add(buffer);
			}
			audioSource.close();
		}

		for await (const wrapped of sink.canvasesAtTimestamps(timestamps)) {
			if (!wrapped) continue;

			ctx.drawImage(wrapped.canvas, 0, 0, maxWidth, maxHeight);
			await videoSource.add(wrapped.timestamp, frameInterval);
		}

		videoSource.close();
		await output.finalize();

		const buffer = output.target.buffer;
		if (!buffer) throw new Error("Failed to compress video");

		return new File(
			[buffer],
			file.name.replace(/\.[^.]+$/, "_compressed.mp4"),
			{ type: "video/mp4" },
		);
	} finally {
		input.dispose();
	}
}
