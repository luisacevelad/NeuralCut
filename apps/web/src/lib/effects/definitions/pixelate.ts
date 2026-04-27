import type { EffectDefinition } from "@/lib/effects/types";

export const PIXELATE_SHADER = "pixelate";

export const pixelateEffectDefinition: EffectDefinition = {
	type: "pixelate",
	name: "Pixelate",
	keywords: [
		"pixelate",
		"pixel",
		"mosaic",
		"mosaic",
		"censor",
		"blocky",
		"pixel art",
	],
	params: [
		{
			key: "size",
			label: "Pixel Size",
			type: "number",
			default: 10,
			min: 1,
			max: 100,
			step: 1,
		},
	],
	renderer: {
		passes: [
			{
				shader: PIXELATE_SHADER,
				uniforms: ({ effectParams }) => ({
					u_size:
						typeof effectParams.size === "number"
							? effectParams.size
							: 10,
				}),
			},
		],
	},
};
