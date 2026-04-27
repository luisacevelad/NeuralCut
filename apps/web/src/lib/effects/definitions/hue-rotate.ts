import type { EffectDefinition } from "@/lib/effects/types";

export const HUE_ROTATE_SHADER = "hue-rotate";

export const hueRotateEffectDefinition: EffectDefinition = {
	type: "hue-rotate",
	name: "Hue Rotate",
	keywords: ["hue", "rotate", "color shift", "color wheel", "phase"],
	params: [
		{
			key: "angle",
			label: "Angle",
			type: "number",
			default: 0,
			min: 0,
			max: 360,
			step: 1,
		},
	],
	renderer: {
		passes: [
			{
				shader: HUE_ROTATE_SHADER,
				uniforms: ({ effectParams }) => ({
					u_angle:
						(typeof effectParams.angle === "number"
							? effectParams.angle
							: 0) / 360,
				}),
			},
		],
	},
};
