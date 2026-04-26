import type { EffectDefinition } from "@/lib/effects/types";

export const SEPIA_SHADER = "sepia";

export const sepiaEffectDefinition: EffectDefinition = {
	type: "sepia",
	name: "Sepia",
	keywords: ["sepia", "vintage", "warm", "old", "retro", "antique"],
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
				shader: SEPIA_SHADER,
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
