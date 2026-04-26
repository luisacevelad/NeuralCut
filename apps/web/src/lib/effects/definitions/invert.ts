import type { EffectDefinition } from "@/lib/effects/types";

export const INVERT_SHADER = "invert";

export const invertEffectDefinition: EffectDefinition = {
	type: "invert",
	name: "Invert",
	keywords: ["invert", "negative", "reverse", "opposite"],
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
				shader: INVERT_SHADER,
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
