import type { EffectDefinition } from "@/lib/effects/types";

export const TINT_SHADER = "tint";

function hexToRgb(hex: string): [number, number, number] {
	const cleaned = hex.replace("#", "");
	if (cleaned.length === 3) {
		const r = parseInt(cleaned[0] + cleaned[0], 16) / 255;
		const g = parseInt(cleaned[1] + cleaned[1], 16) / 255;
		const b = parseInt(cleaned[2] + cleaned[2], 16) / 255;
		return [r, g, b];
	}
	const r = parseInt(cleaned.substring(0, 2), 16) / 255;
	const g = parseInt(cleaned.substring(2, 4), 16) / 255;
	const b = parseInt(cleaned.substring(4, 6), 16) / 255;
	return [r, g, b];
}

export const tintEffectDefinition: EffectDefinition = {
	type: "tint",
	name: "Tint",
	keywords: ["tint", "color overlay", "colorize", "wash"],
	params: [
		{
			key: "color",
			label: "Color",
			type: "color",
			default: "#ff0000",
		},
		{
			key: "intensity",
			label: "Intensity",
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
				shader: TINT_SHADER,
				uniforms: ({ effectParams }) => {
					const hex =
						typeof effectParams.color === "string"
							? effectParams.color
							: "#ff0000";
					const [r, g, b] = hexToRgb(hex);
					return {
						u_intensity:
							typeof effectParams.intensity === "number"
								? effectParams.intensity
								: 50,
						u_tint_color: [r, g, b],
					};
				},
			},
		],
	},
};
