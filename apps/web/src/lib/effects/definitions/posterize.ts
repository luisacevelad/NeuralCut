import type { EffectDefinition } from "@/lib/effects/types";

export const POSTERIZE_SHADER = "posterize";

export const posterizeEffectDefinition: EffectDefinition = {
	type: "posterize",
	name: "Posterize",
	keywords: ["posterize", "poster", "levels", "reduce colors", "flat"],
	params: [
		{
			key: "levels",
			label: "Levels",
			type: "number",
			default: 8,
			min: 2,
			max: 32,
			step: 1,
		},
	],
	renderer: {
		passes: [
			{
				shader: POSTERIZE_SHADER,
				uniforms: ({ effectParams }) => ({
					u_levels:
						typeof effectParams.levels === "number"
							? effectParams.levels
							: 8,
				}),
			},
		],
	},
};
