import type { EffectDefinition } from "@/lib/effects/types";

export const GLOW_SHADER = "glow";

export const glowEffectDefinition: EffectDefinition = {
	type: "glow",
	name: "Glow",
	keywords: [
		"glow",
		"bloom",
		"light",
		"radiance",
		"luminous",
		"shine",
		"bright glow",
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
			key: "threshold",
			label: "Threshold",
			type: "number",
			default: 70,
			min: 0,
			max: 100,
			step: 1,
		},
		{
			key: "radius",
			label: "Radius",
			type: "number",
			default: 4,
			min: 1,
			max: 20,
			step: 1,
		},
	],
	renderer: {
		passes: [
			{
				shader: GLOW_SHADER,
				uniforms: ({ effectParams }) => ({
					u_intensity:
						typeof effectParams.intensity === "number"
							? effectParams.intensity
							: 50,
					u_threshold:
						typeof effectParams.threshold === "number"
							? effectParams.threshold
							: 70,
					u_radius:
						typeof effectParams.radius === "number"
							? effectParams.radius
							: 4,
				}),
			},
		],
	},
};
