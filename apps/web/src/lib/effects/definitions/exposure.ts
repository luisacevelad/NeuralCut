import type { EffectDefinition } from "@/lib/effects/types";

export const EXPOSURE_SHADER = "exposure";

export const exposureEffectDefinition: EffectDefinition = {
	type: "exposure",
	name: "Exposure",
	keywords: [
		"exposure",
		"brightness",
		"light",
		"photo",
		"ev",
		"camera",
		"overexpose",
		"underexpose",
	],
	params: [
		{
			key: "exposure",
			label: "Exposure",
			type: "number",
			default: 0,
			min: -3,
			max: 3,
			step: 0.1,
		},
	],
	renderer: {
		passes: [
			{
				shader: EXPOSURE_SHADER,
				uniforms: ({ effectParams }) => ({
					u_exposure:
						typeof effectParams.exposure === "number"
							? effectParams.exposure
							: 0,
				}),
			},
		],
	},
};
