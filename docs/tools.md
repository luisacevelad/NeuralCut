# Neural Cut Agent Tools

Este documento contiene todas las tools disponibles para el agente de IA de Neural Cut. Estas son las herramientas que el modelo puede invocar para realizar operaciones de edición de video.

## Timeline

### `list_timeline`

Lista la línea de tiempo activa como pistas y elementos editables con metadatos de capa.

**Descripción:** Lista el timeline como pistas estructuradas y elementos editables. Los valores de inicio/fin de los elementos están en segundos. Las pistas incluyen posición (fila de arriba a abajo), visualLayer (las capas superiores se renderizan sobre las inferiores), isVisualLayer, y stacking.

**Parámetros:** Ninguno

**Retorna:** Estructura con tracks y elementos, incluyendo element refs como 'clip-1', 'text-3', etc.

---

### `split`

Divide elementos de la línea de tiempo en uno o más tiempos específicos en segundos.

**Descripción:** Divide elementos de timeline en tiempos sin borrar, cortar o mover contenido. Usa un tiempo para un corte simple, o múltiples tiempos para aislar rangos.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `times` | `number[]` | Sí | Tiempos en segundos donde dividir |

---

### `delete_timeline_elements`

Elimina uno o más elementos del timeline.

**Descripción:** Elimina elementos. Preferir usar refs humanas como 'clip-1', 'text-3'. Para eliminar un rango de tiempo, primero hacer split en los límites del rango.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `targets` | `string[]` | Sí | Element refs o ids a eliminar |

---

### `move_timeline_elements`

Mueve uno o más elementos a un nuevo tiempo de inicio.

**Descripción:** Mueve elementos a un nuevo tiempo de inicio en segundos. Opcionalmente pasar targetTrackRef para mover a otra pista compatible.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `targets` | `string[]` | Sí | Element refs o ids a mover |
| `start` | `number` | Sí | Nuevo inicio en segundos |
| `targetTrackRef` | `string` | No | Pista destino (ej: 'main-1', 'overlay-1') |

---

### `duplicate_elements`

Duplica uno o más elementos del timeline.

**Descripción:** Duplica elementos. Las copias se colocan en nuevas pistas sobre los originales.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `elementIds` | `string[]` | Sí | Ids de elementos a duplicar |

---

### `update_timeline_element_timing`

Actualiza el timing de un elemento existente.

**Descripción:** Actualiza el timing de un elemento. start, end, y duration están en segundos; pasar al menos uno de ellos.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `elementId` | `string` | Sí | Id del elemento |
| `start` | `number` | No | Nuevo inicio en segundos |
| `end` | `number` | No | Nuevo fin en segundos |
| `duration` | `number` | No | Nueva duración en segundos |

---

### `toggle_track_mute`

Alterna mute en una pista del timeline.

**Descripción:** Alterna mute en una pista. Solo funciona en pistas que soportan audio.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `trackId` | `string` | Sí | Id de la pista |

**Retorna:** Nuevo estado de mute.

---

### `toggle_track_visibility`

Alterna visibilidad en una pista del timeline.

**Descripción:** Alterna visibilidad. Las pistas ocultas no se renderizan en el preview.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `trackId` | `string` | Sí | Id de la pista |

**Retorna:** Nuevo estado de visibilidad.

---

## Media

### `list_project_assets`

Lista los medios del proyecto.

**Descripción:** Lista los assets de medios del proyecto con ids estables, tipo, duración, y si están usadas en el timeline activo.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `filter` | `string` | No | Filtro de búsqueda |
| `type` | `string` | No | Tipo de asset |

**Retorna:** Lista de assets con id, nombre, tipo, duración, etc.

---

### `add_media_to_timeline`

Agrega un asset existente al timeline.

**Descripción:** Agrega un asset de medios al timeline activo.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `assetId` | `string` | Sí | Id del asset |
| `startTime` | `number` | Sí | Inicio en segundos |
| `trackType` | `string` | Sí | 'main', 'overlay', o 'audio' |
| `duration` | `number` | No | Duración opcional |

---

### `transcribe_audio`

Transcribe audio de un asset.

**Descripción:** Transcribe un asset de video o audio con timing preciso a nivel de palabras. Retorna texto completo, tiempos por palabra, scores de confianza, y segmentos.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `assetId` | `string` | No | Nombre o id del asset |
| `language` | `string` | No | Hint de idioma ('auto' o omitir) |

**Retorna:** Texto completo, array de palabras con start/end times, segmentos.

---

### `load_context`

Carga contexto multimodal para un asset o elemento.

**Descripción:** Carga contexto Gemini multimodal para un asset del proyecto o elemento del timeline.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `targetType` | `string` | Sí | 'asset' o 'timeline_element' |
| `id` | `string` | No | Asset name/id o element ref/id |
| `assetId` | `string` | No | Asset id o nombre |
| `elementId` | `string` | No | Element id o ref del timeline |

---

## Text

### `add_text`

Agrega texto visual al timeline.

**Descripción:** Agrega texto visual al timeline activo. Soporta modo batch con array `texts` para múltiples elementos independientes.

**Constraints (hard-stop, enforced at tool level):**
- `fontSize`: debe estar entre 6 y 15 inclusive (valores fuera de rango son rechazados, sin clamping). Títulos: max ~15, subtítulos: 6–9.
- Word count: canvas vertical/short-form max 3 palabras, horizontal max 5–6 palabras dependiendo del largo total del texto.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `text` | `string` | Sí | Contenido del texto |
| `start` | `number` | Sí | Inicio en segundos |
| `end` | `number` | Sí | Fin en segundos |
| `position` | `string` | Sí | 'top', 'center', o 'bottom' |
| `style` | `string` | No | 'plain', 'subtitle', 'hook', o 'label' |
| `color` | `string` | No | Color hex |
| `fontSize` | `number` | No | Tamaño de fuente |
| `fontFamily` | `string` | No | Familia de fuente |
| `fontWeight` | `string` | No | 'normal' o 'bold' |
| `fontStyle` | `string` | No | 'normal' o 'italic' |
| `textAlign` | `string` | No | 'left', 'center', o 'right' |
| `letterSpacing` | `number` | No | Espaciado de letras |
| `positionX` | `number` | No | Offset X (-50 a 50) |
| `positionY` | `number` | No | Offset Y (-50 a 50) |
| `background` | `object` | No | Objeto de fondo |

---

### `update_text`

Actualiza propiedades de elementos de texto existentes.

**Descripción:** Actualiza propiedades visuales de elementos de texto. Todos los elementos listados reciben las mismas overrides.

**Constraints (hard-stop, enforced at tool level):**
- `fontSize`: debe estar entre 6 y 15 inclusive (valores fuera de rango son rechazados, sin clamping).
- Word count en `content`: canvas vertical/short-form max 3 palabras, horizontal max 5–6 palabras.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `targets` | `string[]` | Sí | Text element refs o ids |
| `content` | `string` | No | Nuevo contenido |
| `color` | `string` | No | Color hex |
| `fontSize` | `number` | No | Tamaño de fuente |
| `fontFamily` | `string` | No | Familia de fuente |
| `fontWeight` | `string` | No | 'normal' o 'bold' |
| `fontStyle` | `string` | No | 'normal' o 'italic' |
| `textAlign` | `string` | No | 'left', 'center', o 'right' |
| `letterSpacing` | `number` | No | Espaciado |
| `positionX` | `number` | No | Offset X |
| `positionY` | `number` | No | Offset Y |
| `background` | `object` | No | Objeto de fondo |

---

## Elements

### `get_element`

Obtiene metadatos completos de un elemento.

**Descripción:** Retorna metadatos completos de un elemento del timeline.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `target` | `string` | Sí | Element ref o id |

**Retorna:** Propiedades completas según tipo:
- Video/image/graphic: transform, opacity, blendMode, masks, hidden, applied effects
- Text: content, font styles, background, transform
- Audio: volume, muted
- Effect: effectType y valores de parámetros

---

### `update_clip`

Actualiza propiedades de cualquier elemento del timeline.

**Descripción:** Actualiza propiedades de elementos (video, image, graphic, text, sticker, audio, effect).

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `target` | `string` | Sí | Element ref o id |
| `name` | `string` | No | Renombrar elemento |
| `mask` | `object` | No | { action: 'add', maskType } etc. |
| `trimStart` | `number` | No | Segundos a trimar del inicio |
| `trimEnd` | `number` | No | Segundos a trimar del fin |
| `opacity` | `number` | No | Opacidad 0-100 |
| `positionX` | `number` | No | Offset X |
| `positionY` | `number` | No | Offset Y |
| `rotation` | `number` | No | Rotación en grados |
| `scaleX` | `number` | No | Factor de escala X |
| `scaleY` | `number` | No | Factor de escala Y |
| `blendMode` | `string` | No | 'normal', 'darken', 'multiply', 'screen', 'overlay', 'lighten' |
| `hidden` | `boolean` | No | Ocultar elemento |
| `volume` | `number` | No | Volumen 0-100 |
| `muted` | `boolean` | No | Silenciar |

**Mask types:** rectangle, ellipse, heart, diamond, star, split, cinematic-bars (solo video/image/graphic)

---

## Effects

### `list_effects`

Lista todos los efectos disponibles.

**Descripción:**Lista efectos disponibles para aplicar a elementos visuales. Retorna id, nombre, y descripción.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `query` | `string` | No | Búsqueda de efectos |

**Retorna:** Lista de efectos con id, name, description.

---

### `get_effect`

Obtiene metadatos de un efecto específico.

**Descripción:** Retorna metadatos detalladas de un efecto, incluyendo parámetros configurables.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `effectType` | `string` | Sí | Tipo de efecto |

**Retorna:** Parámetros con types, ranges, defaults, descriptions.

---

### `apply_effect`

Agrega un efecto al timeline.

**Descripción:** Agrega un efecto al timeline en un track de efectos. El efecto cubre el rango de tiempo.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `effectType` | `string` | Sí | Tipo de efecto |
| `start` | `number` | Sí | Inicio en segundos |
| `end` | `number` | Sí | Fin en segundos |
| `params` | `object` | No | Parámetros del efecto |

---

### `update_effect`

Actualiza parámetros de un efecto existente.

**Descripción:** Actualiza parámetros de un efecto en el timeline.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `elementId` | `string` | Sí | Id del elemento de efecto |
| `params` | `object` | Sí | Parámetros a actualizar |

---

## Keyframes

### `list_keyframes`

Lista todos los keyframes de un elemento.

**Descripción:** Retorna keyframes agrupados por propiedad animada.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `elementId` | `string` | Sí | Id del elemento |

**Retorna:** keyframes con id, time, value, tipo de interpolación.

---

### `list_animatable_properties`

Lista propiedades animables de un elemento.

**Descripción:**Retorna lista de property paths que soportan animación para un elemento.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `elementId` | `string` | Sí | Id del elemento |

**Retorna:** Propiedades con path, tipo de valor, valor estático actual.

---

### `upsert_keyframe`

Agrega o actualiza un keyframe.

**Descripción:** Agrega o actualiza un keyframe en una propiedad animada.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `elementId` | `string` | Sí | Id del elemento |
| `propertyPath` | `string` | Sí | Path de propiedad |
| `time` | `number` | Sí | Tiempo desde inicio del elemento |
| `value` | `number` | No | Valor numérico |
| `colorValue` | `string` | No | Color hex para propiedades de color |
| `interpolation` | `string` | No | 'linear', 'hold', o 'bezier' |
| `keyframeId` | `string` | No | Id del keyframe (para actualizar) |

---

### `remove_keyframe`

Elimina un keyframe específico.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `elementId` | `string` | Sí | Id del elemento |
| `propertyPath` | `string` | Sí | Path de propiedad |
| `keyframeId` | `string` | Sí | Id del keyframe |

---

### `update_keyframe_curve`

Actualiza la curva de interpolación de un keyframe.

**Descripción:** Actualiza curva/interpolación de un keyframe escalar.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `elementId` | `string` | Sí | Id del elemento |
| `propertyPath` | `string` | Sí | Path de propiedad |
| `keyframeId` | `string` | Sí | Id del keyframe |
| `interpolation` | `string` | No | 'linear', 'bezier', o 'step' |
| `rightHandle` | `object` | No | {dt, dv} offsets |
| `leftHandle` | `object` | No | {dt, dv} offsets |
| `tangentMode` | `string` | No | 'auto', 'aligned', 'broken', 'flat' |

---

## History

### `undo`

Deshace la última acción.

**Descripción:** Deshace la última acción realizada. LLamadas consecutivas deshacen acciones más antiguas.

**Parámetros:** Ninguno

**Retorna:** Profundidad restante del stack de undo.

---

### `redo`

Rehace la última acción deshecha.

**Descripción:** Rehace la última acción deshecha. Solo funciona después de un undo.

**Parámetros:** Ninguno

**Retorna:** Si hay más acciones para rehacer.

---

## Skills

### `list_skills`

Lista skills de edición disponibles.

**Descripción:** Lista recipes de habilidades de edición — workflows pre-construidos para patrones comunes.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `query` | `string` | No | Búsqueda de skills |

**Retorna:** Lista de skills con id, name, description.

---

### `load_skill`

Carga instrucciones completas de un skill.

**Descripción:** Carga las instrucciones completas para un skill específico.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `skillId` | `string` | Sí | Id del skill |

**Retorna:** Instrucciones completas con recipe, timing rules, text styles, effect parameters, quality checklist.

---

## Planning

### `submit_plan`

Envía un plan estructurado para aprobación.

**Descripción:** Envía un plan de edición estructurado con pasos numerados.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `summary` | `string` | Sí | Resumen del plan |
| `steps` | `array` | Sí | Array de pasos |
| `questions` | `array` | No | Preguntas para el usuario |

**Retorna:** Step IDs — usar update_plan_step.

---

### `update_plan_step`

Actualiza el estado de un paso del plan.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `step` | `number` | No | Número de paso (1-based) |
| `stepId` | `string` | No | Id del paso |
| `status` | `string` | Sí | 'pending', 'in_progress', 'done', o 'skipped' |
| `result` | `string` | No | Resultado del paso |

---

### `ask_user`

Pregunta algo al usuario.

**Descripción:** Pregunta al usuario antes o durante la planificación.

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `question` | `string` | Sí | Pregunta |
| `options` | `array` | No | Opciones de respuesta rápida |

---

### `request_plan_approval`

Solicita aprobación para ejecutar un plan.

**Descripción:** Solicita aprobación del usuario para ir de planificación a edición.

**Parámetros:** Ninguno

---

### `render_preview`

Renderiza un preview temporal del timeline completo y lo carga en contexto.

**Descripción:** Exporta el timeline activo como un video MP4 de baja calidad (incluye audio), lo sube a Gemini, y lo carga en el contexto multimodal del agente. El video renderizado incluye todas las pistas, texto, efectos y audio. Usar para revisión visual post-edición.

**Parámetros:** Ninguno

**Retorna:** Estado del render, duración, formato, y contexto multimedia (video URI para análisis por Gemini).

---

## Tool Reference Table

| Tool | Descripción |
|------|-------------|
| `list_timeline` | Lista timeline con tracks y elementos |
| `list_project_assets` | Lista assets del proyecto |
| `get_element` | Obtiene metadatos de un elemento |
| `split` | Divide elementos en tiempos específicos |
| `delete_timeline_elements` | Elimina elementos |
| `move_timeline_elements` | Mueve elementos a nuevo tiempo |
| `duplicate_elements` | Duplica elementos |
| `update_timeline_element_timing` | Actualiza timing de elemento |
| `toggle_track_mute` | Alterna mute de pista |
| `toggle_track_visibility` | Alterna visibilidad de pista |
| `add_media_to_timeline` | Agrega asset al timeline |
| `transcribe_audio` | Transcribe audio |
| `load_context` | Carga contexto multimodal |
| `add_text` | Agrega texto al timeline |
| `update_text` | Actualiza texto |
| `update_clip` | Actualiza propiedades de elemento |
| `list_effects` | Lista efectos disponibles |
| `get_effect` | Obtiene metadatos de efecto |
| `apply_effect` | Aplica efecto al timeline |
| `update_effect` | Actualiza efecto |
| `list_keyframes` | Lista keyframes de elemento |
| `list_animatable_properties` | Lista propiedades animables |
| `upsert_keyframe` | Agrega/actualiza keyframe |
| `remove_keyframe` | Elimina keyframe |
| `update_keyframe_curve` | Actualiza curva de keyframe |
| `undo` | Deshace última acción |
| `redo` | Rehace última acción |
| `list_skills` | Lista skills disponibles |
| `load_skill` | Carga instructions de skill |
| `submit_plan` | Envía plan para aprobación |
| `update_plan_step` | Actualiza paso del plan |
| `ask_user` | Pregunta al usuario |
| `request_plan_approval` | Solicita aprobación |
| `render_preview` | Renderiza preview temporal del timeline |