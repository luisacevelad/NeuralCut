import type { EffectDefinition } from "@/lib/effects/types";

export const MIRROR_SHADER = "mirror";

export const mirrorEffectDefinition: EffectDefinition = {
	type: "mirror",
	name: "Mirror",
	keywords: [
		"mirror",
		"reflect",
		"flip",
		"symmetry",
		"reflection",
		"symmetric",
	],
	params: [
		{
			key: "axis",
			label: "Axis",
			type: "number",
			default: 0,
			min: 0,
			max: 1,
			step: 1,
		},
		{
			key: "position",
			label: "Position",
			type: "number",
			default: 50,
			min: 0,
			max: 100,
			step: 1,
		},
	],
	renderer: {
		passes: [
			{
				shader: MIRROR_SHADER,
				uniforms: ({ effectParams }) => ({
					u_axis:
						typeof effectParams.axis === "number"
							? effectParams.axis
							: 0,
					u_position:
						typeof effectParams.position === "number"
							? effectParams.position
							: 50,
				}),
			},
		],
	},
};
