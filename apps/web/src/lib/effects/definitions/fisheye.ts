import type { EffectDefinition } from "@/lib/effects/types";

export const FISHEYE_SHADER = "fisheye";

export const fisheyeEffectDefinition: EffectDefinition = {
	type: "fisheye",
	name: "Fisheye",
	keywords: [
		"fisheye",
		"fish eye",
		"barrel",
		"pincushion",
		"lens",
		"wide angle",
		"distortion",
	],
	params: [
		{
			key: "strength",
			label: "Strength",
			type: "number",
			default: 50,
			min: -100,
			max: 100,
			step: 1,
		},
	],
	renderer: {
		passes: [
			{
				shader: FISHEYE_SHADER,
				uniforms: ({ effectParams }) => ({
					u_strength:
						typeof effectParams.strength === "number"
							? effectParams.strength
							: 50,
				}),
			},
		],
	},
};
