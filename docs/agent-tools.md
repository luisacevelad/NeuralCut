# Agent Tools — Lista propuesta

Este documento resume las tools propuestas para el agente de NeuralCut. La idea es mantenerlas **primitivas, acotadas y componibles**, no crear una tool por cada feature de marketing.

## Principio

El agente debe combinar primitives simples:

- primero entiende el proyecto/assets,
- luego decide qué acción hacer,
- después ejecuta operaciones concretas del editor.

No queremos tools gigantes tipo “hazme un reel completo”. Eso debe ser un flujo del agente usando varias tools pequeñas.

---

## Tools de contexto y percepción

### `list_project_assets`

Lista assets conocidos del proyecto.

```ts
{
  filter?: "all" | "used" | "unused";
  type?: "all" | "video" | "audio" | "image";
}
```

Uso:
- saber qué archivos existen,
- distinguir assets usados/no usados,
- decidir qué asset cargar o editar.

---

### `list_timeline`

Lista el estado actual del timeline.

```ts
{}
```

Uso:
- saber qué clips/textos/stickers/effects existen,
- obtener `trackId` y `elementId`,
- preparar operaciones como cortar, borrar o editar.

---

### `load_asset_context`

Carga un asset en el contexto multimodal del agente usando Gemini.

```ts
{
  assetId: string;
}
```

Uso:
- subir/procesar video, audio o imagen con Gemini,
- dejar el asset disponible para razonamiento posterior,
- cachear la referencia para no subirlo repetidamente.

> Esta reemplaza la idea anterior de `analyze_video({ question })` o `analyze_asset({ analysisType })`. La tool no “pregunta”; solo carga el asset al contexto.

---

### `get_asset_context` *(infra interna, no tool visible)*

Recupera información/cache de un asset ya cargado.

```ts
{
  assetId: string;
}
```

Uso:
- reutilizar análisis/contexto previo,
- evitar re-upload,
- permitir que el agente sepa si un asset ya está disponible para Gemini.

> Esta NO debería exponerse necesariamente como tool al LLM. Es más sano tratarla como infraestructura interna del agente/orquestador: `load_asset_context` carga y cachea; el orquestador/store puede consultar el cache e inyectar ese estado en el prompt/contexto sin hacer que el modelo llame una tool administrativa.

---

## Tools de edición primitivas

### `cut_segment`

Corta o remueve un rango de tiempo del timeline.

```ts
{
  start: number;
  end: number;
  mode: "remove" | "keep";
}
```

Uso:
- quitar silencios,
- quitar errores,
- recortar intro/outro,
- construir highlights.

---

### `add_media_to_timeline`

Agrega un asset existente al timeline.

```ts
{
  assetId: string;
  startTime: number;
  trackType: "main" | "overlay" | "audio";
}
```

Uso:
- insertar clips,
- agregar música,
- poner b-roll,
- agregar imágenes/logos.

---

### `delete_element`

Elimina un elemento específico del timeline.

```ts
{
  trackId: string;
  elementId: string;
}
```

Uso:
- borrar clips,
- borrar textos,
- borrar stickers,
- borrar efectos standalone si aplica.

---

### `add_text`

Agrega texto visual al timeline.

```ts
{
  text: string;
  start: number;
  end: number;
  position: "top" | "center" | "bottom";
  style?: "plain" | "subtitle" | "hook" | "label";
}
```

Uso:
- subtítulos,
- hooks,
- títulos,
- labels,
- texto explicativo.

---

### `update_text`

Actualiza un texto existente.

```ts
{
  trackId: string;
  elementId: string;
  text?: string;
  start?: number;
  end?: number;
  position?: "top" | "center" | "bottom";
}
```

Uso:
- corregir texto,
- cambiar timing,
- mover captions/hooks.

---

### `add_sticker`

Agrega un sticker al timeline.

```ts
{
  stickerId: string;
  start: number;
  end: number;
  position: "top-left" | "top-right" | "center" | "bottom-left" | "bottom-right";
}
```

Uso:
- agregar elementos visuales simples,
- reacciones,
- énfasis gráfico.

---

### `set_volume`

Ajusta volumen de un elemento de audio/video.

```ts
{
  trackId: string;
  elementId: string;
  volume: number; // 0–1
}
```

Uso:
- bajar música,
- subir voz,
- mutear clip,
- balance básico.

---

### `apply_effect`

Aplica un efecto existente a un clip.

```ts
{
  trackId: string;
  elementId: string;
  effectType: "blur";
  params?: {
    intensity?: number;
  };
}
```

Uso:
- aplicar blur.

> El repo actualmente tiene infraestructura de efectos, pero el efecto real registrado parece ser solo `blur`. Corrección de color/LUTs todavía no está disponible.

---

## Tools existentes o en standby

### `transcribe_video`

Transcribe audio de video/audio usando Whisper local.

```ts
{
  assetId?: string;
  language?: string;
  modelId?: string;
}
```

Uso:
- subtítulos,
- captions,
- búsqueda de frases exactas,
- edición por texto.

Estado:
- implementada,
- útil como herramienta secundaria,
- no debe ser la tool principal para entender el video si Gemini puede cargar el asset multimodalmente.

---

## Ideas descartadas o diferidas

### `analyze_video({ question })`

Descartada como primitive principal porque mete “chat dentro de la tool”. Mejor usar `load_asset_context` y dejar que el agente razone con el contexto cargado.

### `analyze_asset({ analysisType })`

Descartada porque `analysisType` introduce categorías artificiales. Gemini debe cargar el asset completo al contexto; el agente decide qué hacer después.

### `remove_silences`

Diferida/no prioritaria porque se puede expresar como flujo con `cut_segment`.

### `generate_subtitles`

Diferida porque se puede construir con `transcribe_video` + `add_text`.

### `color_correct` / `apply_lut`

Diferida porque el repo actual no parece tener corrección de color/LUTs implementados todavía.

---

## Orden recomendado

1. `list_project_assets`
2. `list_timeline`
3. `load_asset_context`
4. `cut_segment`
5. `add_text`
6. `add_media_to_timeline`
7. `delete_element`
8. `set_volume`
9. `add_sticker`
10. `apply_effect`

Infra interna asociada:

- `get_asset_context` / cache lookup para `assetId -> Gemini fileUri/status/summary`, no necesariamente visible para el LLM.
