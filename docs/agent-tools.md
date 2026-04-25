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

### `split`

Hace splits/cortes en uno o más puntos de tiempo del timeline, sin borrar contenido.

```ts
{
  times: number[]; // timeline seconds
}
```

Uso:
- cortar en un punto específico,
- aislar una sección antes de borrarla con otra tool usando dos tiempos,
- preparar edición por rangos,
- separar intro/outro sin eliminar nada,
- dejarle al agente una primitive composable para flujos más grandes.

> `split` NO elimina material. Si el usuario pide “eliminá esta parte”, el agente debe componer `split` con `delete_timeline_elements`.

---

### `add_media_to_timeline`

Agrega un asset existente al timeline.

```ts
{
  assetId: string;
  startTime: number;
  trackType: "main" | "overlay" | "audio";
  duration?: number; // timeline seconds
}
```

Uso:
- insertar clips,
- agregar música,
- poner b-roll,
- agregar imágenes/logos,
- definir cuánto dura una imagen o un tramo insertado.

---

### `update_timeline_element_timing`

Actualiza el inicio, final o duración de un elemento existente del timeline.

```ts
{
  elementId: string;
  start?: number;
  end?: number;
  duration?: number;
}
```

Uso:
- hacer que una foto dure más o menos,
- ajustar el final de un texto/sticker/imagen,
- mover el inicio y mantener o recalcular duración,
- recortar la duración visible de audio/video sin cambiar el asset original.

---

### `delete_timeline_elements`

Elimina uno o más elementos específicos del timeline.

```ts
{
	elementIds: string[];
}
```

Uso:
- borrar clips,
- borrar textos,
- borrar stickers,
- borrar efectos standalone si aplica.

> Para borrar un rango, el agente debe hacer `split({ times: [start, end] })`, volver a listar/identificar los elementos aislados si hace falta, y luego llamar `delete_timeline_elements`.

---

### `move_timeline_elements`

Mueve uno o más elementos existentes del timeline a otro tiempo y, opcionalmente, a otra pista compatible.

```ts
{
  elementIds: string[];
  start: number; // timeline seconds
  targetTrackId?: string;
}
```

Uso:
- mover un clip al inicio,
- correr subtítulos unos segundos,
- reubicar b-roll en una pista superior,
- mantener un grupo sincronizado preservando offsets relativos.

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

Diferida/no prioritaria porque se puede expresar como flujo con `split` + `delete_timeline_elements`.

### `generate_subtitles`

Diferida porque se puede construir con `transcribe_video` + `add_text`.

### `color_correct` / `apply_lut`

Diferida porque el repo actual no parece tener corrección de color/LUTs implementados todavía.

---

## Orden recomendado

1. `list_project_assets`
2. `list_timeline`
3. `load_asset_context`
4. `split`
5. `delete_timeline_elements`
6. `move_timeline_elements`
7. `add_media_to_timeline`
8. `update_timeline_element_timing`
9. `add_text`
10. `set_volume`
11. `add_sticker`
12. `apply_effect`

Infra interna asociada:

- `get_asset_context` / cache lookup para `assetId -> Gemini fileUri/status/summary`, no necesariamente visible para el LLM.
