import type { EffectDefinition } from "@/lib/effects/types";

export const EMBOSS_SHADER = "emboss";

export const embossEffectDefinition: EffectDefinition = {
	type: "emboss",
	name: "Emboss",
	keywords: [
		"emboss",
		"relief",
		"3d",
		"raised",
		"bump",
		"sculpture",
		"engrave",
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
		{
			key: "angle",
			label: "Angle",
			type: "number",
			default: 135,
			min: 0,
			max: 360,
			step: 1,
		},
	],
	renderer: {
		passes: [
			{
				shader: EMBOSS_SHADER,
				uniforms: ({ effectParams }) => ({
					u_intensity:
						typeof effectParams.intensity === "number"
							? effectParams.intensity
							: 50,
					u_angle:
						typeof effectParams.angle === "number"
							? effectParams.angle
							: 135,
				}),
			},
		],
	},
};
