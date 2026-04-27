import type { EffectDefinition } from "@/lib/effects/types";

export const CHROMATIC_ABERRATION_SHADER = "chromatic-aberration";

export const chromaticAberrationEffectDefinition: EffectDefinition = {
	type: "chromatic-aberration",
	name: "Chromatic Aberration",
	keywords: [
		"chromatic aberration",
		"chromatic",
		"aberration",
		"rgb split",
		"fringe",
		"prism",
		"color fringe",
	],
	params: [
		{
			key: "offset",
			label: "Offset",
			type: "number",
			default: 15,
			min: 0,
			max: 50,
			step: 1,
		},
	],
	renderer: {
		passes: [
			{
				shader: CHROMATIC_ABERRATION_SHADER,
				uniforms: ({ effectParams }) => ({
					u_offset:
						typeof effectParams.offset === "number"
							? effectParams.offset
							: 15,
				}),
			},
		],
	},
};
