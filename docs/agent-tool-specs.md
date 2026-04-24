# Agent Tool Specs — NeuralCut

Este documento define las primitives iniciales del agente. Cada tool debe ser pequeña, accionable y componible. El agente puede resolver features complejas combinando estas tools, pero ninguna tool debe intentar “hacer todo”.

## Principios generales

- Las tools reciben datos estructurados, no instrucciones libres.
- Las tools deben validar inputs y devolver errores claros.
- Las tools que modifican el editor deben usar los comandos/managers existentes para preservar undo/redo cuando aplique.
- El agente debe usar `list_project_assets` y `list_timeline` antes de editar cuando no tenga IDs concretos.
- Gemini se usa para comprensión multimodal; la edición real se ejecuta con tools determinísticas.

---

## 1. `list_project_assets`

### Propósito
Listar assets disponibles en el proyecto para que el agente sepa qué archivos existen y cuáles están usados en el timeline.

### Input
```ts
{
  filter?: "all" | "used" | "unused";
  type?: "all" | "video" | "audio" | "image";
}
```

### Output
```ts
{
  assets: Array<{
    id: string;
    name: string;
    type: "video" | "audio" | "image";
    duration?: number;
    usedInTimeline: boolean;
  }>;
}
```

### Requirements
- MUST return all loaded project assets by default.
- MUST support filtering by usage: `used`, `unused`, `all`.
- MUST support filtering by asset type.
- MUST include stable internal `id` values.
- MUST NOT mutate editor state.

### Errors
- If no project is loaded, return `{ error: "No active project" }`.

---

## 2. `list_timeline`

### Propósito
Listar el estado actual del timeline para que el agente pueda referenciar clips, textos, stickers y otros elementos por `trackId`/`elementId`.

### Input
```ts
{}
```

### Output
```ts
{
  tracks: Array<{
    trackId: string;
    type: "main" | "overlay" | "audio" | "text" | "effect";
    elements: Array<{
      elementId: string;
      type: string;
      assetId?: string;
      name?: string;
      start: number;
      end: number;
    }>;
  }>;
}
```

### Requirements
- MUST return a structured timeline summary.
- MUST include `trackId` and `elementId` for editable elements.
- MUST include timing in seconds or a clearly documented unit.
- MUST NOT mutate editor state.

### Errors
- If no active scene/timeline exists, return `{ error: "No active timeline" }`.

---

## 3. `load_asset_context`

### Propósito
Cargar un asset en el contexto multimodal del agente usando Gemini. Esta es la base para que el agente entienda video/audio/imagen antes de editar.

### Input
```ts
{
  assetId: string;
}
```

### Output
```ts
{
  assetId: string;
  status: "loaded" | "processing";
  cached: boolean;
  provider: "gemini";
  fileUri?: string;
  summary?: string;
}
```

### Requirements
- MUST resolve the asset by internal `assetId`.
- MAY support fallback by filename if unambiguous, but internal ID is preferred.
- MUST upload/process the asset with Gemini when not cached.
- MUST cache the provider file reference by `assetId` to avoid repeated uploads.
- MUST keep API keys server-side.
- MUST support video first; audio/image support may be added if Gemini path supports it cleanly.
- MUST NOT edit the timeline.

### Cache behavior
- Cache is application/orchestrator infrastructure, not necessarily a visible LLM tool.
- Cache should store at least:
  ```ts
  {
    assetId: string;
    provider: "gemini";
    fileUri: string;
    status: "active" | "processing" | "failed";
    createdAt: number;
  }
  ```

### Errors
- Unknown asset: `{ error: "Asset not found" }`.
- Unsupported type: `{ error: "Unsupported asset type" }`.
- Upload/processing failure: `{ error: "Failed to load asset context" }` with safe details.

### Non-goals
- No editing actions.
- No `@asset` UI autocomplete.
- No streaming progress in the first implementation.

---

## 4. `cut_segment`

### Propósito
Cortar o remover un rango de tiempo del timeline.

### Input
```ts
{
  start: number;
  end: number;
  mode: "remove" | "keep";
}
```

### Output
```ts
{
  success: boolean;
  affectedElements: string[];
}
```

### Requirements
- MUST validate `start < end`.
- MUST operate on timeline time, using the editor’s canonical time unit internally.
- MUST use existing timeline/command infrastructure when possible.
- `remove` MUST remove the selected time range.
- `keep` MUST preserve only the selected time range and remove outside material, if feasible in current editor model.
- MUST preserve undo/redo behavior if the editor supports it for the operation.

### Errors
- Invalid range: `{ error: "Invalid time range" }`.
- Empty timeline: `{ error: "No timeline content" }`.
- Unsupported mode: `{ error: "Unsupported cut mode" }`.

---

## 5. `add_text`

### Propósito
Agregar texto visual al timeline. Esta primitive cubre títulos, hooks, labels y subtítulos básicos.

### Input
```ts
{
  text: string;
  start: number;
  end: number;
  position: "top" | "center" | "bottom";
  style?: "plain" | "subtitle" | "hook" | "label";
}
```

### Output
```ts
{
  elementId: string;
  trackId: string;
}
```

### Requirements
- MUST validate non-empty `text`.
- MUST validate `start < end`.
- MUST create a text element using existing timeline APIs.
- MUST map `position` to a sensible default placement.
- SHOULD provide simple style presets, but implementation may start with defaults.
- MUST NOT generate full subtitles automatically; that is a flow using transcript/context + repeated `add_text` calls.

### Errors
- Empty text: `{ error: "Text is required" }`.
- Invalid range: `{ error: "Invalid time range" }`.

---

## 6. `update_text`

### Propósito
Editar un texto existente en el timeline.

### Input
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

### Output
```ts
{
  success: boolean;
  elementId: string;
}
```

### Requirements
- MUST find an existing text element by `trackId` + `elementId`.
- MUST only update provided fields.
- MUST validate timing if `start`/`end` are provided.
- MUST preserve undo/redo behavior if supported.

### Errors
- Missing element: `{ error: "Text element not found" }`.
- Wrong element type: `{ error: "Element is not text" }`.
- Invalid range: `{ error: "Invalid time range" }`.

---

## 7. `add_media_to_timeline`

### Propósito
Agregar un asset existente al timeline.

### Input
```ts
{
  assetId: string;
  startTime: number;
  trackType: "main" | "overlay" | "audio";
}
```

### Output
```ts
{
  elementId: string;
  trackId: string;
}
```

### Requirements
- MUST resolve asset by `assetId`.
- MUST validate asset type compatibility with `trackType`.
- MUST insert the element using existing timeline APIs.
- SHOULD choose a sensible track when one is not obvious, but first version requires explicit `trackType`.

### Errors
- Asset not found: `{ error: "Asset not found" }`.
- Invalid track type: `{ error: "Invalid track type for asset" }`.

---

## 8. `delete_element`

### Propósito
Eliminar un elemento específico del timeline.

### Input
```ts
{
  trackId: string;
  elementId: string;
}
```

### Output
```ts
{
  success: boolean;
}
```

### Requirements
- MUST find element by `trackId` + `elementId`.
- MUST remove only that element.
- MUST preserve undo/redo behavior if supported.

### Errors
- Missing element: `{ error: "Element not found" }`.

---

## 9. `set_volume`

### Propósito
Ajustar volumen de un elemento de audio o video.

### Input
```ts
{
  trackId: string;
  elementId: string;
  volume: number;
}
```

### Output
```ts
{
  success: boolean;
  volume: number;
}
```

### Requirements
- MUST validate `volume` in range `0..1`.
- MUST only apply to elements that support audio volume.
- MUST preserve undo/redo behavior if supported.

### Errors
- Invalid volume: `{ error: "Volume must be between 0 and 1" }`.
- Unsupported element: `{ error: "Element does not support volume" }`.

---

## 10. `add_sticker`

### Propósito
Agregar un sticker existente al timeline.

### Input
```ts
{
  stickerId: string;
  start: number;
  end: number;
  position: "top-left" | "top-right" | "center" | "bottom-left" | "bottom-right";
}
```

### Output
```ts
{
  elementId: string;
  trackId: string;
}
```

### Requirements
- MUST resolve sticker by `stickerId`.
- MUST validate `start < end`.
- MUST create a timeline element using existing sticker/timeline APIs.
- MUST map `position` to sensible coordinates.

### Errors
- Sticker not found: `{ error: "Sticker not found" }`.
- Invalid range: `{ error: "Invalid time range" }`.

---

## 11. `apply_effect`

### Propósito
Aplicar un efecto existente a un clip. En el estado actual del repo, el efecto real disponible parece ser `blur`.

### Input
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

### Output
```ts
{
  effectId: string;
  elementId: string;
}
```

### Requirements
- MUST validate the element is visual and supports effects.
- MUST validate `effectType` exists in the effects registry.
- MUST apply default params when `params` are omitted.
- MUST validate `intensity` if provided.
- MUST preserve undo/redo behavior if supported.

### Errors
- Effect not found: `{ error: "Effect not found" }`.
- Unsupported element: `{ error: "Element does not support effects" }`.
- Invalid params: `{ error: "Invalid effect parameters" }`.

---

## Existing/secondary tool: `transcribe_video`

### Propósito
Transcribir audio usando Whisper local. Es útil para captions y edición por texto, pero no debe ser la primitive principal de comprensión si `load_asset_context` con Gemini está disponible.

### Input
```ts
{
  assetId?: string;
  language?: string;
  modelId?: string;
}
```

### Estado
- Implementada.
- Debe mantenerse como secundaria.
- Puede ser usada por flujos de subtítulos.
