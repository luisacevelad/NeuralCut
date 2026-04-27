import { effectsRegistry } from "../registry";
import { blurEffectDefinition } from "./blur";
import { brightnessContrastEffectDefinition } from "./brightness-contrast";
import { grayscaleEffectDefinition } from "./grayscale";
import { invertEffectDefinition } from "./invert";
import { saturationEffectDefinition } from "./saturation";
import { sepiaEffectDefinition } from "./sepia";
import { vignetteEffectDefinition } from "./vignette";
import { hueRotateEffectDefinition } from "./hue-rotate";
import { colorTemperatureEffectDefinition } from "./color-temperature";
import { tintEffectDefinition } from "./tint";
import { posterizeEffectDefinition } from "./posterize";
import { duotoneEffectDefinition } from "./duotone";
import { crossProcessEffectDefinition } from "./cross-process";
import { pixelateEffectDefinition } from "./pixelate";
import { chromaticAberrationEffectDefinition } from "./chromatic-aberration";
import { glitchEffectDefinition } from "./glitch";
import { waveEffectDefinition } from "./wave";
import { mirrorEffectDefinition } from "./mirror";
import { kaleidoscopeEffectDefinition } from "./kaleidoscope";
import { fisheyeEffectDefinition } from "./fisheye";
import { sharpenEffectDefinition } from "./sharpen";
import { glowEffectDefinition } from "./glow";
import { exposureEffectDefinition } from "./exposure";
import { shadowsHighlightsEffectDefinition } from "./shadows-highlights";
import { edgeDetectionEffectDefinition } from "./edge-detection";
import { embossEffectDefinition } from "./emboss";
import { filmGrainEffectDefinition } from "./film-grain";
import { halftoneEffectDefinition } from "./halftone";
import { scanlinesEffectDefinition } from "./scanlines";
import { colorKeyEffectDefinition } from "./color-key";

const defaultEffects = [
	blurEffectDefinition,
	brightnessContrastEffectDefinition,
	grayscaleEffectDefinition,
	saturationEffectDefinition,
	sepiaEffectDefinition,
	invertEffectDefinition,
	vignetteEffectDefinition,
	hueRotateEffectDefinition,
	colorTemperatureEffectDefinition,
	tintEffectDefinition,
	posterizeEffectDefinition,
	duotoneEffectDefinition,
	crossProcessEffectDefinition,
	pixelateEffectDefinition,
	chromaticAberrationEffectDefinition,
	glitchEffectDefinition,
	waveEffectDefinition,
	mirrorEffectDefinition,
	kaleidoscopeEffectDefinition,
	fisheyeEffectDefinition,
	sharpenEffectDefinition,
	glowEffectDefinition,
	exposureEffectDefinition,
	shadowsHighlightsEffectDefinition,
	edgeDetectionEffectDefinition,
	embossEffectDefinition,
	filmGrainEffectDefinition,
	halftoneEffectDefinition,
	scanlinesEffectDefinition,
	colorKeyEffectDefinition,
];

export function registerDefaultEffects(): void {
	for (const definition of defaultEffects) {
		if (effectsRegistry.has(definition.type)) {
			continue;
		}
		effectsRegistry.register(definition.type, definition);
	}
}
