import type { EffectDefinition } from "@/lib/effects/types";

export const GLITCH_SHADER = "glitch";

export const glitchEffectDefinition: EffectDefinition = {
	type: "glitch",
	name: "Glitch",
	keywords: [
		"glitch",
		"corruption",
		"digital",
		"error",
		"bug",
		"distort",
		"vhs",
		"corrupt",
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
			key: "blockSize",
			label: "Block Size",
			type: "number",
			default: 20,
			min: 1,
			max: 100,
			step: 1,
		},
	],
	renderer: {
		passes: [
			{
				shader: GLITCH_SHADER,
				uniforms: ({ effectParams }) => ({
					u_intensity:
						typeof effectParams.intensity === "number"
							? effectParams.intensity
							: 50,
					u_block_size:
						typeof effectParams.blockSize === "number"
							? effectParams.blockSize
							: 20,
				}),
			},
		],
	},
};
