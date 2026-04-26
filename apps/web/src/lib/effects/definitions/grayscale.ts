import type { EffectDefinition } from "@/lib/effects/types";

export const GRAYSCALE_SHADER = "grayscale";

export const grayscaleEffectDefinition: EffectDefinition = {
	type: "grayscale",
	name: "Grayscale",
	keywords: ["grayscale", "grey", "black and white", "monochrome", "desaturate"],
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
	],
	renderer: {
		passes: [
			{
				shader: GRAYSCALE_SHADER,
				uniforms: ({ effectParams }) => {
					const raw = effectParams.intensity;
					const intensity =
						typeof raw === "number" ? raw / 100 : 1;
					return { u_intensity: intensity };
				},
			},
		],
	},
};
