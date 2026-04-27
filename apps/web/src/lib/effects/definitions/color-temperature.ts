import type { EffectDefinition } from "@/lib/effects/types";

export const COLOR_TEMPERATURE_SHADER = "color-temperature";

export const colorTemperatureEffectDefinition: EffectDefinition = {
	type: "color-temperature",
	name: "Color Temperature",
	keywords: ["temperature", "warm", "cool", "white balance", "kelvin"],
	params: [
		{
			key: "temperature",
			label: "Temperature",
			type: "number",
			default: 0,
			min: -100,
			max: 100,
			step: 1,
		},
	],
	renderer: {
		passes: [
			{
				shader: COLOR_TEMPERATURE_SHADER,
				uniforms: ({ effectParams }) => ({
					u_temperature:
						typeof effectParams.temperature === "number"
							? effectParams.temperature / 100
							: 0,
				}),
			},
		],
	},
};
