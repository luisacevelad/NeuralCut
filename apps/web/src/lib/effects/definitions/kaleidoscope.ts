import type { EffectDefinition } from "@/lib/effects/types";

export const KALEIDOSCOPE_SHADER = "kaleidoscope";

export const kaleidoscopeEffectDefinition: EffectDefinition = {
	type: "kaleidoscope",
	name: "Kaleidoscope",
	keywords: [
		"kaleidoscope",
		"kaleidoscopic",
		"radial",
		"symmetry",
		"pattern",
		"mandala",
		"segments",
	],
	params: [
		{
			key: "segments",
			label: "Segments",
			type: "number",
			default: 6,
			min: 2,
			max: 24,
			step: 1,
		},
		{
			key: "angle",
			label: "Angle",
			type: "number",
			default: 0,
			min: 0,
			max: 360,
			step: 1,
		},
	],
	renderer: {
		passes: [
			{
				shader: KALEIDOSCOPE_SHADER,
				uniforms: ({ effectParams }) => ({
					u_segments:
						typeof effectParams.segments === "number"
							? effectParams.segments
							: 6,
					u_angle:
						typeof effectParams.angle === "number"
							? effectParams.angle
							: 0,
				}),
			},
		],
	},
};
