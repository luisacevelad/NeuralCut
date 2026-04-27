import type { EffectDefinition } from "@/lib/effects/types";

export const CROSS_PROCESS_SHADER = "cross-process";

export const crossProcessEffectDefinition: EffectDefinition = {
	type: "cross-process",
	name: "Cross Process",
	keywords: [
		"cross process",
		"crossprocess",
		"film",
		"analog",
		"vintage",
		"lo-fi",
		"lofi",
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
	],
	renderer: {
		passes: [
			{
				shader: CROSS_PROCESS_SHADER,
				uniforms: ({ effectParams }) => ({
					u_intensity:
						typeof effectParams.intensity === "number"
							? effectParams.intensity
							: 100,
				}),
			},
		],
	},
};
