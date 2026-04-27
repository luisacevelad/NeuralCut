import type { EffectDefinition } from "@/lib/effects/types";

export const SHADOWS_HIGHLIGHTS_SHADER = "shadows-highlights";

export const shadowsHighlightsEffectDefinition: EffectDefinition = {
	type: "shadows-highlights",
	name: "Shadows / Highlights",
	keywords: [
		"shadows",
		"highlights",
		"shadow",
		"highlight",
		"tone",
		"recover",
		"fill light",
		"contrast",
	],
	params: [
		{
			key: "shadows",
			label: "Shadows",
			type: "number",
			default: 0,
			min: -100,
			max: 100,
			step: 1,
		},
		{
			key: "highlights",
			label: "Highlights",
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
				shader: SHADOWS_HIGHLIGHTS_SHADER,
				uniforms: ({ effectParams }) => ({
					u_shadows:
						typeof effectParams.shadows === "number"
							? effectParams.shadows
							: 0,
					u_highlights:
						typeof effectParams.highlights === "number"
							? effectParams.highlights
							: 0,
				}),
			},
		],
	},
};
