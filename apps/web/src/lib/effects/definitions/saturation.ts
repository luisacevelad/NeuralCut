import type { EffectDefinition } from "@/lib/effects/types";

export const SATURATION_SHADER = "saturation";

export const saturationEffectDefinition: EffectDefinition = {
	type: "saturation",
	name: "Saturation",
	keywords: ["saturation", "vibrance", "vivid", "color", "desaturate"],
	params: [
		{
			key: "saturation",
			label: "Saturation",
			type: "number",
			default: 100,
			min: 0,
			max: 300,
			step: 1,
		},
	],
	renderer: {
		passes: [
			{
				shader: SATURATION_SHADER,
				uniforms: ({ effectParams }) => {
					const raw = effectParams.saturation;
					const saturation =
						typeof raw === "number" ? raw / 100 : 1;
					return { u_saturation: saturation };
				},
			},
		],
	},
};
