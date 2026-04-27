import type { EffectDefinition } from "@/lib/effects/types";

export const DUOTONE_SHADER = "duotone";

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

export const duotoneEffectDefinition: EffectDefinition = {
	type: "duotone",
	name: "Duotone",
	keywords: ["duotone", "two tone", "two color", "dual tone"],
	params: [
		{
			key: "shadowColor",
			label: "Shadow Color",
			type: "color",
			default: "#001428",
		},
		{
			key: "highlightColor",
			label: "Highlight Color",
			type: "color",
			default: "#ff6b35",
		},
		{
			key: "intensity",
			label: "Intensity",
			type: "number",
			default: 100,
			min: 0,
			max: 100,
			step: 1,
		},
	],
	renderer: {
		passes: [
			{
				shader: DUOTONE_SHADER,
				uniforms: ({ effectParams }) => {
					const shadowHex =
						typeof effectParams.shadowColor === "string"
							? effectParams.shadowColor
							: "#001428";
					const highlightHex =
						typeof effectParams.highlightColor === "string"
							? effectParams.highlightColor
							: "#ff6b35";
					const [sr, sg, sb] = hexToRgb(shadowHex);
					const [hr, hg, hb] = hexToRgb(highlightHex);
					return {
						u_intensity:
							typeof effectParams.intensity === "number"
								? effectParams.intensity
								: 100,
						u_shadow_color: [sr, sg, sb],
						u_highlight_color: [hr, hg, hb],
					};
				},
			},
		],
	},
};
