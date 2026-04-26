import { effectsRegistry } from "../registry";
import { blurEffectDefinition } from "./blur";
import { brightnessContrastEffectDefinition } from "./brightness-contrast";
import { grayscaleEffectDefinition } from "./grayscale";
import { invertEffectDefinition } from "./invert";
import { saturationEffectDefinition } from "./saturation";
import { sepiaEffectDefinition } from "./sepia";
import { vignetteEffectDefinition } from "./vignette";

const defaultEffects = [
	blurEffectDefinition,
	brightnessContrastEffectDefinition,
	grayscaleEffectDefinition,
	saturationEffectDefinition,
	sepiaEffectDefinition,
	invertEffectDefinition,
	vignetteEffectDefinition,
];

export function registerDefaultEffects(): void {
	for (const definition of defaultEffects) {
		if (effectsRegistry.has(definition.type)) {
			continue;
		}
		effectsRegistry.register(definition.type, definition);
	}
}
