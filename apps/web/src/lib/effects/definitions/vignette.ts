import type { EffectDefinition } from "@/lib/effects/types";

export const VIGNETTE_SHADER = "vignette";

export const vignetteEffectDefinition: EffectDefinition = {
	type: "vignette",
	name: "Vignette",
	keywords: ["vignette", "dark edges", "focus", "spotlight", "center"],
	params: [
		{
			key: "radius",
			label: "Radius",
			type: "number",
			default: 75,
			min: 10,
			max: 100,
			step: 1,
		},
		{
			key: "softness",
			label: "Softness",
			type: "number",
			default: 35,
			min: 5,
			max: 80,
			step: 1,
		},
	],
	renderer: {
		passes: [
			{
				shader: VIGNETTE_SHADER,
				uniforms: ({ effectParams }) => {
					const rawRadius = effectParams.radius;
					const rawSoftness = effectParams.softness;
					const radius =
						(typeof rawRadius === "number" ? rawRadius : 75) /
						100;
					const softness =
						(typeof rawSoftness === "number"
							? rawSoftness
							: 35) / 100;
					return { u_radius: radius, u_softness: softness };
				},
			},
		],
	},
};
