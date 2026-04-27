import type { EffectDefinition } from "@/lib/effects/types";

export const EDGE_DETECTION_SHADER = "edge-detection";

export const edgeDetectionEffectDefinition: EffectDefinition = {
	type: "edge-detection",
	name: "Edge Detection",
	keywords: [
		"edge",
		"edges",
		"detection",
		"sobel",
		"outline",
		"contour",
		"border",
		"trace",
	],
	params: [
		{
			key: "intensity",
			label: "Intensity",
			type: "number",
			default: 100,
			min: 0,
			max: 100,
			step: 1,
		},
		{
			key: "threshold",
			label: "Threshold",
			type: "number",
			default: 10,
			min: 0,
			max: 100,
			step: 1,
		},
	],
	renderer: {
		passes: [
			{
				shader: EDGE_DETECTION_SHADER,
				uniforms: ({ effectParams }) => ({
					u_intensity:
						typeof effectParams.intensity === "number"
							? effectParams.intensity
							: 100,
					u_threshold:
						typeof effectParams.threshold === "number"
							? effectParams.threshold
							: 10,
				}),
			},
		],
	},
};
