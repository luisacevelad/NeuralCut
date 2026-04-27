import type { EffectDefinition } from "@/lib/effects/types";

export const FILM_GRAIN_SHADER = "film-grain";

export const filmGrainEffectDefinition: EffectDefinition = {
	type: "film-grain",
	name: "Film Grain",
	keywords: [
		"film grain",
		"grain",
		"noise",
		"film",
		"analog",
		"dust",
		"scratch",
		"vintage",
	],
	params: [
		{
			key: "intensity",
			label: "Intensity",
			type: "number",
			default: 30,
			min: 0,
			max: 100,
			step: 1,
		},
		{
			key: "size",
			label: "Grain Size",
			type: "number",
			default: 1,
			min: 1,
			max: 10,
			step: 1,
		},
	],
	renderer: {
		passes: [
			{
				shader: FILM_GRAIN_SHADER,
				uniforms: ({ effectParams }) => ({
					u_intensity:
						typeof effectParams.intensity === "number"
							? effectParams.intensity
							: 30,
					u_size:
						typeof effectParams.size === "number"
							? effectParams.size
							: 1,
				}),
			},
		],
	},
};
