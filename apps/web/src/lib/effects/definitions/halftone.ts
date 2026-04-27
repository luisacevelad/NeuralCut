import type { EffectDefinition } from "@/lib/effects/types";

export const HALFTONE_SHADER = "halftone";

export const halftoneEffectDefinition: EffectDefinition = {
	type: "halftone",
	name: "Halftone",
	keywords: [
		"halftone",
		"half tone",
		"dots",
		"print",
		"newspaper",
		"comic",
		"pop art",
		"screen",
	],
	params: [
		{
			key: "dotSize",
			label: "Dot Size",
			type: "number",
			default: 4,
			min: 1,
			max: 20,
			step: 1,
		},
		{
			key: "angle",
			label: "Angle",
			type: "number",
			default: 45,
			min: 0,
			max: 360,
			step: 1,
		},
	],
	renderer: {
		passes: [
			{
				shader: HALFTONE_SHADER,
				uniforms: ({ effectParams }) => ({
					u_dot_size:
						typeof effectParams.dotSize === "number"
							? effectParams.dotSize
							: 4,
					u_angle:
						typeof effectParams.angle === "number"
							? effectParams.angle
							: 45,
				}),
			},
		],
	},
};
