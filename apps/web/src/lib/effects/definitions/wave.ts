import type { EffectDefinition } from "@/lib/effects/types";

export const WAVE_SHADER = "wave";

export const waveEffectDefinition: EffectDefinition = {
	type: "wave",
	name: "Wave",
	keywords: [
		"wave",
		"warp",
		"undulate",
		"sinusoidal",
		"ripple",
		"sine",
		"wavy",
		"wiggle",
	],
	params: [
		{
			key: "amplitude",
			label: "Amplitude",
			type: "number",
			default: 30,
			min: 0,
			max: 100,
			step: 1,
		},
		{
			key: "frequency",
			label: "Frequency",
			type: "number",
			default: 5,
			min: 1,
			max: 50,
			step: 1,
		},
	],
	renderer: {
		passes: [
			{
				shader: WAVE_SHADER,
				uniforms: ({ effectParams }) => ({
					u_amplitude:
						typeof effectParams.amplitude === "number"
							? effectParams.amplitude
							: 30,
					u_frequency:
						typeof effectParams.frequency === "number"
							? effectParams.frequency
							: 5,
				}),
			},
		],
	},
};
