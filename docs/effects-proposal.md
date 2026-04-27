# NeuralCut — Propuesta de Nuevos Efectos

## Arquitectura del sistema de efectos

Los efectos usan **WGSL fragment shaders** via wgpu con un buffer de uniforms genérico:

```
GenericUniformBuffer {
    resolution: vec2f,
    scalars: array<vec4f, 2>,  // hasta 8 floats
    vectors: array<vec4f, 2>,   // hasta 8 componentes vectoriales
}
```

Pipeline: TypeScript definition → `resolveEffectPasses()` → JSON → Rust/WASM → wgpu shader → fullscreen quad → ping-pong entre passes.

Para agregar un efecto se tocan exactamente 4 archivos:
1. `rust/crates/effects/src/shaders/<name>.wgsl`
2. `rust/crates/effects/src/pipeline.rs` (SHADER_REGISTRY + pack function)
3. `apps/web/src/lib/effects/definitions/<name>.ts`
4. `apps/web/src/lib/effects/definitions/index.ts`

---

## Efectos actuales (7)

| Tipo | Nombre | Params |
|------|--------|--------|
| `blur` | Blur | `intensity` (0-100) |
| `brightness-contrast` | Brightness / Contrast | `brightness` (-1 a 1), `contrast` (0-3) |
| `grayscale` | Grayscale | `intensity` (0-100) |
| `saturation` | Saturation | `saturation` (0-300) |
| `sepia` | Sepia | `intensity` (0-100) |
| `invert` | Invert | `intensity` (0-100) |
| `vignette` | Vignette | `radius` (10-100), `softness` (5-80) |

---

## Efectos propuestos

### Color (single-pass)

| Efecto | Tipo | Params | Descripción |
|--------|------|--------|-------------|
| **Hue Rotate** | `hue-rotate` | `angle` (0-360) | Rota el hue en espacio HSL |
| **Color Temperature** | `color-temperature` | `temperature` (-100 a 100) | Cálido (naranja) ↔ frío (azul) |
| **Tint** | `tint` | `color` (hex), `intensity` (0-100) | Superpone un tinte de color |
| **Posterize** | `posterize` | `levels` (2-32) | Reduce niveles de color (efecto póster) |
| **Duotone** | `duotone` | `shadowColor`, `highlightColor`, `intensity` | Mapea tonos a dos colores |
| **Cross Process** | `cross-process` | `intensity` (0-100) | Simula revelado cruzado analógico |

### Distorsión (single o multi-pass)

| Efecto | Tipo | Params | Descripción |
|--------|------|--------|-------------|
| **Pixelate** | `pixelate` | `size` (1-100) | Agrupa píxeles en bloques |
| **Chromatic Aberration** | `chromatic-aberration` | `offset` (0-50) | Separa canales RGB |
| **Glitch** | `glitch` | `intensity`, `blockSize` | Corrupción digital + RGB split |
| **Wave / Warp** | `wave` | `amplitude`, `frequency` | Distorsión sinusoidal |
| **Mirror** | `mirror` | `axis`, `position` | Refleja la mitad de la imagen |
| **Kaleidoscope** | `kaleidoscope` | `segments`, `angle` | Simetría radial |
| **Fisheye** | `fisheye` | `strength` (-100 a 100) | Distorsión barrel/pincushion |

### Luz (Glow es multi-pass, el resto single)

| Efecto | Tipo | Params | Descripción |
|--------|------|--------|-------------|
| **Sharpen** | `sharpen` | `intensity` (0-100) | Convolución de enfoque 3x3 |
| **Glow / Bloom** | `glow` | `intensity`, `threshold`, `radius` | Brillo expandido (2-3 passes) |
| **Exposure** | `exposure` | `exposure` (-3 a 3) | Ajuste fotográfico multiplicativo |
| **Shadows/Highlights** | `shadows-highlights` | `shadows`, `highlights` | Ajuste independiente |

### Bordes (single-pass, convolución)

| Efecto | Tipo | Params | Descripción |
|--------|------|--------|-------------|
| **Edge Detection** | `edge-detection` | `intensity`, `threshold` | Detección Sobel |
| **Emboss** | `emboss` | `intensity`, `angle` | Efecto relieve |

### Estilo (single-pass)

| Efecto | Tipo | Params | Descripción |
|--------|------|--------|-------------|
| **Film Grain** | `film-grain` | `intensity`, `size` | Ruido fotográfico analógico |
| **Halftone** | `halftone` | `dotSize`, `angle` | Medio tono |
| **Scanlines** | `scanlines` | `intensity`, `count`, `speed` | Líneas CRT |
| **Color Key** | `color-key` | `keyColor`, `tolerance`, `softness` | Elimina color de fondo |

---

## Prioridad recomendada

1. **Chromatic Aberration** — muy popular, fácil
2. **Hue Rotate** — básico esperado en cualquier editor
3. **Color Temperature** — ajuste fundamental
4. **Pixelate** — simple, útil para censura
5. **Film Grain** — muy pedido
6. **Glow/Bloom** — complejo pero visualmente impactante (3 passes)
7. **Sharpen** — utilidad básica
8. **Posterize** — artístico simple
