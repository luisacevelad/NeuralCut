import type { EffectDefinition } from "@/lib/effects/types";

export const SHARPEN_SHADER = "sharpen";

export const sharpenEffectDefinition: EffectDefinition = {
	type: "sharpen",
	name: "Sharpen",
	keywords: [
		"sharpen",
		"sharp",
		"focus",
		"detail",
		"crisp",
		"enhance",
		"unsharp mask",
	],
	params: [
		{
			key: "intensity",
			label: "Intensity",
			type: "number",
			default: 50,
			min: 0,
			max: 100,
			step: 1,
		},
	],
	renderer: {
		passes: [
			{
				shader: SHARPEN_SHADER,
				uniforms: ({ effectParams }) => ({
					u_intensity:
						typeof effectParams.intensity === "number"
							? effectParams.intensity
							: 50,
				}),
			},
		],
	},
};
