import { effectsRegistry } from "../registry";
import { blurEffectDefinition } from "./blur";
import { brightnessContrastEffectDefinition } from "./brightness-contrast";
import { grayscaleEffectDefinition } from "./grayscale";

const defaultEffects = [
	blurEffectDefinition,
	brightnessContrastEffectDefinition,
	grayscaleEffectDefinition,
];

export function registerDefaultEffects(): void {
	for (const definition of defaultEffects) {
		if (effectsRegistry.has(definition.type)) {
			continue;
		}
		effectsRegistry.register(definition.type, definition);
	}
}
