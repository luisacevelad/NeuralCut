import type { EffectDefinition } from "@/lib/effects/types";

export const COLOR_KEY_SHADER = "color-key";

function hexToRgb(hex: string): [number, number, number] {
	const clean = hex.replace("#", "");
	return [
		Number.parseInt(clean.substring(0, 2), 16) / 255,
		Number.parseInt(clean.substring(2, 4), 16) / 255,
		Number.parseInt(clean.substring(4, 6), 16) / 255,
	];
}

export const colorKeyEffectDefinition: EffectDefinition = {
	type: "color-key",
	name: "Color Key",
	keywords: [
		"color key",
		"colorkey",
		"green screen",
		"chroma key",
		"chromakey",
		"remove color",
		"transparent",
		"background",
	],
	params: [
		{
			key: "keyColor",
			label: "Key Color",
			type: "color",
			default: "#00ff00",
		},
		{
			key: "tolerance",
			label: "Tolerance",
			type: "number",
			default: 40,
			min: 0,
			max: 100,
			step: 1,
		},
		{
			key: "softness",
			label: "Softness",
			type: "number",
			default: 10,
			min: 0,
			max: 100,
			step: 1,
		},
	],
	renderer: {
		passes: [
			{
				shader: COLOR_KEY_SHADER,
				uniforms: ({ effectParams }) => ({
					u_tolerance:
						typeof effectParams.tolerance === "number"
							? effectParams.tolerance
							: 40,
					u_softness:
						typeof effectParams.softness === "number"
							? effectParams.softness
							: 10,
					u_key_color:
						typeof effectParams.keyColor === "string"
							? hexToRgb(effectParams.keyColor)
							: hexToRgb("#00ff00"),
				}),
			},
		],
	},
};
