import type { EffectDefinition } from "@/lib/effects/types";

export const SCANLINES_SHADER = "scanlines";

export const scanlinesEffectDefinition: EffectDefinition = {
	type: "scanlines",
	name: "Scanlines",
	keywords: [
		"scanlines",
		"scan lines",
		"crt",
		"tv",
		"television",
		"retro",
		"vhs",
		"display",
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
			key: "count",
			label: "Line Count",
			type: "number",
			default: 240,
			min: 10,
			max: 1080,
			step: 1,
		},
	],
	renderer: {
		passes: [
			{
				shader: SCANLINES_SHADER,
				uniforms: ({ effectParams }) => ({
					u_intensity:
						typeof effectParams.intensity === "number"
							? effectParams.intensity
							: 30,
					u_count:
						typeof effectParams.count === "number"
							? effectParams.count
							: 240,
				}),
			},
		],
	},
};
