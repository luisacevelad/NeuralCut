# Propuesta Técnica — Agente Conversacional para Edición de Video

**Proyecto Expoandes | Introducción a la Ingeniería de Sistemas y Computación**

---

## 0. Tabla de contenidos

1. Resumen del proyecto
2. Problema y solución
3. Diferenciador competitivo
4. Arquitectura general
5. Stack tecnológico completo
6. Capa de abstracción de proveedores (clave)
7. Detalle de tools del agente (skills)
8. Flujos de usuario end-to-end
9. Plan de desarrollo (Scrum)
10. Consideraciones de performance y costos
11. Estrategia de demo para feria
12. Riesgos y mitigaciones
13. Apéndices técnicos

---

## 1. Resumen del proyecto

**Nombre tentativo:** [Por definir]

**Una línea:** Un editor de video web con un agente conversacional que entiende lenguaje natural y edita por ti. *Lo que Cursor es a VSCode, esto es a CapCut.*

**Entregable:** MVP funcional desplegado en web, con un agente capaz de ejecutar al menos 8 "skills" de edición a partir de instrucciones en lenguaje natural.

### 1.1. Estado actual de la dirección técnica

> **Nota para agentes y desarrolladores nuevos:** este documento empezó como propuesta general. La dirección actual del proyecto se refinó durante la implementación inicial. Para tareas concretas de tools, usar también `docs/agent-tools.md` y `docs/agent-tool-specs.md` como referencia operativa.

Decisiones vigentes:

- El agente ya no debe diseñarse como una lista de “features IA” aisladas, sino como un **orquestador con tools primitivas, pequeñas y componibles**.
- La base del producto es que el agente pueda **entender assets multimodales** con Gemini y luego ejecutar acciones determinísticas sobre el editor.
- `transcribe_video` existe y es útil, pero queda como **tool secundaria** para subtítulos/captions/búsqueda textual. No debe ser la herramienta principal de comprensión del video.
- La herramienta principal de percepción a implementar es `load_asset_context`, que carga un asset en el contexto multimodal de Gemini y cachea su referencia.
- `get_asset_context` es infraestructura interna/cache, no necesariamente una tool visible al LLM.
- Las tools de edición deben mapearse a acciones reales del editor: cortar, agregar texto, insertar media, borrar elementos, volumen, stickers y efectos existentes.
- El repo actual tiene infraestructura de efectos, pero el efecto real registrado parece ser **solo `blur`**; corrección de color/LUTs queda fuera del scope inmediato.
- El core actual del agente es **provider-agnostic** con providers configurables por `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL`.
- Ya existen adapters para `openai-compatible` y `gemini`.
- Gemini es el proveedor prioritario para video understanding. `LLM_PROVIDER=gemini` con `LLM_MODEL=gemini-3-flash-preview` es la configuración deseada para pruebas de la killer feature.

Roadmap vigente de alto nivel:

1. **Contexto y percepción:** `list_project_assets`, `list_timeline`, `load_asset_context`.
2. **Edición básica:** `split`, `delete_timeline_elements`, `move_timeline_elements`, `add_media_to_timeline`, `update_timeline_element_timing`, `add_text`.
3. **Ajustes simples:** `set_volume`, `add_sticker`, `apply_effect`.
4. **UX avanzada:** referencias `@asset`, progreso de uploads/procesamiento, previews/aprobaciones.

---

## 2. Problema y solución

### Problema identificado

Los creadores de contenido pequeños y medianos (YouTubers, tiktokers, podcasters, educadores, periodistas estudiantes) invierten entre 3 y 5 horas editando cada pieza de contenido. La mayor parte de ese tiempo se consume en tareas mecánicas:

- Cortar silencios y muletillas ("eh", "emm", "o sea")
- Encontrar los mejores momentos en grabaciones largas
- Generar subtítulos con estilo
- Reformatear entre aspect ratios (horizontal → vertical)
- Aplicar corrección de color básica
- Sincronizar cortes con música

Las herramientas actuales resuelven piezas aisladas pero todas exigen aprender una interfaz compleja y ejecutar cada acción manualmente.

### Solución

Un editor de video con un **agente conversacional autónomo** que ejecuta estas tareas por instrucción en lenguaje natural, pero mantiene siempre la edición manual tradicional como respaldo.

**Ejemplo concreto:**

> *Usuario:* "Tengo un video de 5 minutos de mí explicando el proyecto. Hazme un reel de 30 segundos con los mejores momentos, subtítulos amarillos estilo TikTok, y formato vertical siguiendo mi cara."
>
> *Agente:* [transcribe → analiza escenas → identifica momentos de alta energía → corta → reencuadra dinámicamente → renderiza subtítulos → entrega]

---

## 3. Diferenciador competitivo

| Producto | Edición manual | Agente conversacional | Multimodal | Open source base |
|---|---|---|---|---|
| CapCut / Premiere | ✅ | ❌ | ❌ | ❌ |
| Descript | ⚠️ (via transcripción) | ❌ | ❌ | ❌ |
| Opus Clip | ❌ | ⚠️ (automático fijo) | ⚠️ | ❌ |
| Runway | ⚠️ | ❌ | ✅ | ❌ |
| DeeVid.ai / Sora | ❌ | ❌ | ✅ (genera) | ❌ |
| **Nuestra propuesta** | ✅ | ✅ | ✅ | ✅ |

**El moat técnico:** esto no es una caja negra que genera contenido y ya — es un **editor de video completo** donde el usuario mantiene control total. Lo que Cursor es a VSCode, NeuralCut es a CapCut: un agente autónomo que opera sobre una herramienta real, no un generador sin ventana de edición. El usuario puede hablarle en lenguaje natural Y editar manualmente en la misma interfaz.

---

## 4. Arquitectura general

```
╔══════════════════════════════════════════════════════════╗
║                    NAVEGADOR DEL USUARIO                  ║
║                                                            ║
║  ┌────────────────────────┐  ┌────────────────────────┐  ║
║  │   UI NeuralCut (web)   │  │   Panel de chat nuevo  │  ║
║  │                         │  │                         │  ║
║  │  • Timeline multi-pista│  │  • Historial de chat   │  ║
║  │  • Preview             │  │  • Input de texto      │  ║
║  │  • Media bin           │  │  • Streaming response  │  ║
║  │  • Efectos             │  │  • Approvals inline    │  ║
║  └───────────┬────────────┘  └───────────┬────────────┘  ║
║              │                             │               ║
║              └─────────────┬───────────────┘               ║
║                            ▼                               ║
║  ┌───────────────────────────────────────────────────┐   ║
║  │            ZUSTAND STORES (estado único)          │   ║
║  │  editorStore · timelineStore · mediaStore         │   ║
║  │  playbackStore · chatStore · agentStore           │   ║
║  └───────────────────────────────────────────────────┘   ║
║                            │                               ║
║         ┌──────────────────┼──────────────────┐           ║
║         ▼                  ▼                  ▼           ║
║  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   ║
║  │ FFmpeg.wasm  │  │  MediaBunny  │  │  WebCodecs   │   ║
║  │ (operaciones │  │  (extracción │  │  (decode/    │   ║
║  │  complejas)  │  │   rápida)    │  │   encode)    │   ║
║  └──────────────┘  └──────────────┘  └──────────────┘   ║
║                                                            ║
║  ┌───────────────────────────────────────────────────┐   ║
║  │  STORAGE: IndexedDB + OPFS (ya en NeuralCut)      │   ║
║  └───────────────────────────────────────────────────┘   ║
╚══════════════════════════════════════════════════════════╝
                             │
                             ▼ (HTTPS)
╔══════════════════════════════════════════════════════════╗
║        CAPA DEL AGENTE (TypeScript — apps/web/)          ║
║                                                            ║
║  Orquestación, tool calling, streaming, estado:           ║
║                                                            ║
║  agent/orchestrator.ts → coordina LLM + tools            ║
║  agent/tools/*.ts       → definiciones de cada tool       ║
║  agent/prompts/         → system prompt y templates       ║
║  providers/             → abstracción de proveedores      ║
║  app/api/agent/         → Next.js API routes              ║
║                                                            ║
║  El agente es I/O-bound: llama APIs, parsea JSON,        ║
║  maneja streaming. No necesita Rust.                      ║
╚══════════════════════════════════════════════════════════╝
               │                              │
               │ cuando necesita               │ siempre
               │ procesamiento                 │ para LLMs
               │ pesado                        │ / APIs
               ▼                              ▼
╔════════════════════════╗    ╔══════════════════════════╗
║  rust/ — PROCESAMIENTO ║    ║  PROVEEDORES EXTERNOS     ║
║  (WASM, CPU-bound)     ║    ║                            ║
║                        ║    ║  ┌─────────────────────┐  ║
║  • compositor/         ║    ║  │ LOCAL (dev, gratis)  │  ║
║  • effects/            ║    ║  │ Qwen2.5-VL (Ollama) │  ║
║  • gpu/                ║    ║  │ whisper.cpp         │  ║
║  • masks/              ║    ║  │ Qwen3-8B           │  ║
║  • time/               ║    ║  └─────────────────────┘  ║
║  • bridge/             ║    ║  ┌─────────────────────┐  ║
║                        ║    ║  │ CLOUD (demo, rápido)│  ║
║  Detección de silencios║    ║  │ Gemini 2.5 Flash   │  ║
║  Detección de escenas  ║    ║  │ Claude Opus/Haiku   │  ║
║  Face tracking         ║    ║  │ Whisper API        │  ║
║  Beat detection        ║    ║  └─────────────────────┘  ║
╚════════════════════════╝    ╚══════════════════════════╝
```

---

## 5. Stack tecnológico completo

### 5.1. Frontend y base del editor

| Tecnología | Rol | Justificación |
|---|---|---|
| Fork de OpenCut (NeuralCut) | Base del editor | CapCut open source (MIT, 48k★). Timeline, preview, storage ya funcionan. Nos permite enfocarnos en el agente. |
| **Next.js 16** | Framework React | Ya viene en el fork. App Router, API routes, deploy trivial en Vercel. |
| **React 19** | UI | Estándar. |
| **Zustand** | State management | Ya viene en OpenCut. Simple y reactivo. |
| **Tailwind CSS** | Styling | Ya viene en OpenCut. |
| **shadcn/ui** | Componentes UI | Para el panel de chat nuevo. |
| **Bun** | Runtime / package manager | Ya viene en OpenCut. 3-5x más rápido que npm. |

### 5.1.1. Decisión arquitectónica: TypeScript para el agente, Rust para procesamiento

El agente conversacional (orquestación, tool calling, providers, streaming) se implementa en **TypeScript** dentro de `apps/web/src/agent/`. Las razones:

- **I/O-bound**: el 90% del trabajo del agente es llamar APIs, esperar respuestas y parsear JSON. Rust no agrega valor acá.
- **Ecosistema maduro**: Vercel AI SDK, Anthropic SDK, OpenAI SDK, streaming con `ReadableStream` — todo first-class en TS. En Rust no hay equivalentes.
- **WASM no tiene networking**: para llamar a Gemini o Claude desde Rust+WASM habría que hacer un bridge a JS, lo cual es un roundtrip innecesario.
- **Iteración rápida**: prompts y tool definitions cambian constantemente. Hot reload en TS vs compile time en Rust.

**Rust (`rust/`)** se reserva exclusivamente para procesamiento **CPU-bound** que corre en el browser via WASM: composición de video, efectos, detección de silencios/escenas, face tracking, beat detection. El agente en TS llama a estas funciones Rust cuando necesita poder de cálculo.

### 5.2. Procesamiento de video (client-side)

| Tecnología | Rol | Notas |
|---|---|---|
| **FFmpeg.wasm** | Operaciones complejas (cortes, filtros, export) | Ya integrado en OpenCut. Lento pero universal. |
| **MediaBunny** | Extracción de frames y conversiones rápidas | 5x más rápido que FFmpeg.wasm en muchas operaciones. Remotion lo recomienda oficialmente desde 2025. |
| **WebCodecs API** | Decode/encode con aceleración de hardware | Nativo del browser. Más rápido que cualquier WASM. |

### 5.3. IA — Capas del agente

#### Orquestador (LLM principal)

| Proveedor | Modelo recomendado | Uso |
|---|---|---|
| Anthropic | **Claude Opus 4.7** | Razonamiento complejo, tool calling confiable |
| Anthropic | **Claude Haiku 4.5** | Decisiones simples y rápidas (más barato) |
| OpenAI | GPT-5 | Alternativa |
| Local | Qwen3-8B | Para desarrollo |

**Estrategia vigente:** el agente debe ser provider-agnostic. En desarrollo/demo se prioriza Gemini por video understanding. Otros providers OpenAI-compatible/Groq/Ollama pueden usarse para chat y tool calling textual, pero no reemplazan la capacidad multimodal nativa de Gemini.

#### Video Understanding (la killer feature)

| Proveedor | Modelo | Cuándo usarlo |
|---|---|---|
| **Google** | **Gemini 3 Flash / `gemini-3-flash-preview`** | Proveedor prioritario para demo y video understanding multimodal. |
| **Google** | **Gemini 2.5 Flash** | Fallback/alternativa si Gemini 3 Flash está saturado o no disponible. |
| **Google** | Gemini 2.5 Pro | Casos complejos. Más caro. |
| **Local** | **Qwen2.5-VL-7B** | Desarrollo local. Gratis. Entiende video con timestamps nativamente. |
| **Local** | Qwen2.5-VL-3B | Laptops con menos recursos. |

**Dirección vigente:** Gemini no debe usarse solo como LLM de texto. La ventaja real es cargar el asset de video/audio/imagen al contexto multimodal del modelo mediante Files API o mecanismo equivalente. Esa capacidad se modela en el agente con `load_asset_context`.

#### Transcripción (Speech-to-Text)

| Proveedor | Modelo | Notas |
|---|---|---|
| **OpenAI** | **Whisper API** | $0.006/min. Más barato. Mejor accuracy en benchmarks. |
| OpenAI | gpt-4o-transcribe | Más preciso, más caro |
| AssemblyAI | Universal-2 | Mejor formateo, diarización incluida |
| **Local** | **whisper.cpp** | Gratis, corre en CPU decentemente |
| Local | faster-whisper | Más rápido en GPU |

#### Visión computacional (detección)

| Tecnología | Rol |
|---|---|
| **MediaPipe Tasks for Web** | Detección de caras, pose, manos — corre en el browser |
| ONNX Runtime Web + YOLO | Detección de objetos general |
| TransNetV2 | Detección avanzada de transiciones de escena |

#### Audio

| Tecnología | Rol |
|---|---|
| **Web Audio API** | Análisis nativo (RMS, silencios) |
| **Essentia.js** | Detección de beats, tempo, tonalidad |
| FFmpeg silencedetect | Detección alternativa de silencios |

### 5.4. Backend y deploy

| Tecnología | Rol |
|---|---|
| **Next.js API Routes** | Proxy a LLMs, no lógica pesada |
| **Vercel Edge Functions** | Deploy gratis, global |
| **Vercel** | Hosting |

### 5.5. Storage

| Tecnología | Rol |
|---|---|
| **IndexedDB + OPFS** | Primary (ya en OpenCut) — storage local persistente |
| Cloudflare R2 / Supabase | Solo para compartir exports (opcional) |

---

## 6. Capa de abstracción de proveedores (la joya del diseño)

**Objetivo:** poder alternar entre modelos locales (dev, gratis) y APIs (producción, rápido) **sin cambiar código**. Solo cambiando una variable de entorno.

### 6.1. Interfaces abstractas

```typescript
// Interfaz común para todos los proveedores de visión multimodal
interface VisionProvider {
  analyzeVideo(
    videoPath: string,
    prompt: string,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<{
    response: string;
    timestamps?: Array<{ time: string; description: string }>;
    usage: { inputTokens: number; outputTokens: number; cost: number };
  }>;
  
  analyzeImages(
    images: string[],
    prompt: string
  ): Promise<{ response: string; usage: Usage }>;
}

// Interfaz común para STT
interface TranscriptionProvider {
  transcribe(
    audioPath: string,
    options?: { language?: string; wordTimestamps?: boolean }
  ): Promise<{
    text: string;
    segments: Array<{ start: number; end: number; text: string }>;
    words?: Array<{ word: string; start: number; end: number }>;
  }>;
}

// Interfaz común para el LLM orquestador
interface LLMProvider {
  chat(
    messages: Message[],
    tools?: Tool[],
    options?: ChatOptions
  ): AsyncGenerator<ChatChunk>;
}
```

### 6.2. Implementaciones intercambiables

```typescript
// Cada proveedor implementa la misma interfaz
class GeminiVisionProvider implements VisionProvider { ... }
class QwenLocalVisionProvider implements VisionProvider { ... }
class ClaudeVisionProvider implements VisionProvider { ... }

class WhisperAPIProvider implements TranscriptionProvider { ... }
class WhisperLocalProvider implements TranscriptionProvider { ... }
class AssemblyAIProvider implements TranscriptionProvider { ... }

class ClaudeLLMProvider implements LLMProvider { ... }
class OpenAILLMProvider implements LLMProvider { ... }
class OllamaLLMProvider implements LLMProvider { ... }
```

### 6.3. Factory y configuración

```typescript
// providers/factory.ts
export function getVisionProvider(): VisionProvider {
  const provider = process.env.VISION_PROVIDER || 'local';
  
  switch (provider) {
    case 'gemini':
      return new GeminiVisionProvider({
        apiKey: process.env.GEMINI_API_KEY!,
        model: 'gemini-2.5-flash'
      });
    case 'claude':
      return new ClaudeVisionProvider({
        apiKey: process.env.ANTHROPIC_API_KEY!,
        model: 'claude-opus-4-7'
      });
    case 'local':
      return new QwenLocalVisionProvider({
        endpoint: process.env.LOCAL_MODEL_ENDPOINT || 'http://localhost:11434',
        model: 'qwen2.5vl:7b'
      });
    default:
      throw new Error(`Unknown vision provider: ${provider}`);
  }
}
```

### 6.4. Uso desde el resto del código

```typescript
// El resto del código NUNCA sabe qué proveedor está usando
import { getVisionProvider } from '@/providers';

async function findFunnyMoments(videoPath: string) {
  const vision = getVisionProvider(); // abstracto
  const result = await vision.analyzeVideo(
    videoPath,
    "Find all timestamps where someone is laughing"
  );
  return result.timestamps;
}
```

### 6.5. Configuración por ambiente

```bash
# .env.development (día a día de desarrollo)
VISION_PROVIDER=local
TRANSCRIPTION_PROVIDER=local
LLM_PROVIDER=local
LOCAL_MODEL_ENDPOINT=http://localhost:11434

# .env.demo (para feria y demos)
VISION_PROVIDER=gemini
TRANSCRIPTION_PROVIDER=whisper-api
LLM_PROVIDER=claude
GEMINI_API_KEY=...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
```

**Resultado:** cambias una variable, todo el código se adapta solo. 90% del desarrollo es gratis, demos finales usan APIs top.

---

## 7. Detalle de tools del agente

Cada tool es una función que el LLM puede invocar con entrada estructurada. Se definen con schema para que el modelo sepa cuándo llamarlas y para que el orquestador pueda validar argumentos antes de ejecutar.

> **Actualización importante:** la lista original por tiers queda como referencia histórica de ideas posibles. La dirección vigente del proyecto es usar **tools primitivas y componibles**. Para implementación, usar como fuente principal `docs/agent-tool-specs.md`.

### 7.0. Tools primitivas vigentes

Estas son las tools que el equipo debe priorizar. Son suficientemente pequeñas para implementarse y testearse por separado, pero combinables para resolver tareas complejas.

| Tool | Propósito | Estado / prioridad |
|---|---|---|
| `list_project_assets` | Lista assets del proyecto, usados/no usados y por tipo | Prioridad alta |
| `list_timeline` | Devuelve resumen estructurado del timeline con `trackId`/`elementId` | Prioridad alta |
| `load_asset_context` | Carga un asset en el contexto multimodal de Gemini y cachea la referencia | Prioridad crítica / killer feature |
| `split` | Hace cortes puntuales en uno o más timestamps sin borrar contenido | Prioridad alta |
| `delete_timeline_elements` | Borra uno o más elementos concretos del timeline por `elementId` | Prioridad alta |
| `move_timeline_elements` | Mueve elementos existentes a otro tiempo o pista compatible | Prioridad alta |
| `add_text` | Agrega texto visual: hooks, títulos, labels, subtítulos básicos | Prioridad alta |
| `update_text` | Modifica texto existente | Prioridad media |
| `add_media_to_timeline` | Inserta video/audio/imagen existente al timeline | Prioridad alta |
| `update_timeline_element_timing` | Ajusta inicio, final o duración de un elemento existente | Prioridad alta |
| `delete_element` | Reemplazada por `delete_timeline_elements` para soportar borrado en lote | Baja |
| `set_volume` | Ajusta volumen de audio/video | Prioridad media |
| `add_sticker` | Inserta sticker existente | Prioridad media |
| `apply_effect` | Aplica efectos existentes; por ahora principalmente `blur` | Prioridad baja/media |

`transcribe_video` se mantiene como tool secundaria para captions, subtítulos y edición basada en texto. No debe reemplazar a `load_asset_context` para comprensión multimodal.

### 7.0.1. Referencias operativas

- `docs/agent-tools.md` — lista conceptual de tools y decisiones.
- `docs/agent-tool-specs.md` — contratos de input/output, requirements y errores esperados para cada tool.

---

### Lista histórica original

La siguiente lista se conserva como material de ideación, pero no debe tomarse como backlog implementable directo.

### Tier 1 — Fundamentales (MVP must-have)

#### 7.1. `transcribe_video`
```typescript
{
  name: "transcribe_video",
  description: "Transcribe the audio of a video to text with timestamps",
  input: { video_id: string, language?: string },
  output: {
    segments: [{ start: number, end: number, text: string }],
    words: [{ word: string, start: number, end: number }]
  }
}
```
**Implementación (TS → Whisper API o whisper.cpp local):** el agente en TS llama al `TranscriptionProvider` que abstrae si es API o local.

#### 7.2. `detect_silences`
```typescript
{
  name: "detect_silences",
  description: "Find silent parts in audio (for auto-cutting)",
  input: { video_id: string, threshold_db?: number, min_duration?: number },
  output: { silences: [{ start: number, end: number, duration: number }] }
}
```
**Implementación (TS → Web Audio API o Rust WASM):** análisis de amplitud en browser, o detección precisa via WASM para archivos grandes.

#### 7.3. `detect_scenes`
```typescript
{
  name: "detect_scenes",
  description: "Split video into semantic scenes based on visual changes",
  input: { video_id: string, threshold?: number },
  output: { scenes: [{ start: number, end: number, id: string }] }
}
```
**Implementación (TS → FFmpeg o Rust WASM):** frame diff analysis. FFmpeg scene filter para rápido, Rust WASM para precisión.

#### 7.4. `split`
```typescript
{
  name: "split",
  description: "Split timeline elements at one or more timestamps without deleting content",
  input: { times: number[] /* timeline seconds */ },
  output: { success: boolean, affectedElements: string[] }
}
```
**Implementación (TS → comandos del editor):** ejecuta splits determinísticos usando la infraestructura de timeline/commands para preservar undo/redo.

#### 7.5. `concat_segments`
```typescript
{
  name: "concat_segments",
  description: "Concatenate multiple segments in the timeline",
  input: { clip_ids: string[] },
  output: { composite_id: string, total_duration: number }
}
```

### Tier 2 — Visión y comprensión

#### 7.6. `watch_video`
```typescript
{
  name: "watch_video",
  description: "Ask a question about the visual content of a video. Returns answer with relevant timestamps.",
  input: { video_id: string, question: string },
  output: {
    answer: string,
    relevant_timestamps: [{ time: string, reason: string }]
  }
}
```
**Implementación:** Gemini 2.5 Flash (o Qwen2.5-VL local). **Esta es la killer feature.** Gemini soporta context caching nativo: el video se sube una vez al importar al proyecto, y todas las queries posteriores contra ese video son instantáneas y más baratas. No hay re-upload.

#### 7.7. `take_screenshot`
```typescript
{
  name: "take_screenshot",
  description: "Extract a frame from the video at a specific timestamp",
  input: { video_id: string, timestamp: number },
  output: { image_path: string, description?: string }
}
```
**Implementación:** MediaBunny o WebCodecs.

#### 7.8. `describe_scene`
```typescript
{
  name: "describe_scene",
  description: "Get a text description of what's happening in a scene",
  input: { video_id: string, start: number, end: number },
  output: { description: string, objects: string[], actions: string[] }
}
```

### Tier 3 — Operaciones creativas

#### 7.9. `generate_subtitles`
```typescript
{
  name: "generate_subtitles",
  description: "Generate and render styled subtitles",
  input: {
    video_id: string,
    style: "tiktok" | "youtube" | "clean" | "cinematic",
    language?: string,
    color?: string
  },
  output: { subtitle_track_id: string }
}
```

#### 7.10. `apply_lut`
```typescript
{
  name: "apply_lut",
  description: "Apply a color grading LUT to make video look more cinematic",
  input: {
    clip_id: string,
    mood: "warm" | "cool" | "cinematic" | "vintage" | "bright" | "moody"
  },
  output: { effect_id: string }
}
```

#### 7.11. `detect_faces`
```typescript
{
  name: "detect_faces",
  description: "Detect faces in video with bounding boxes per frame",
  input: { video_id: string, start?: number, end?: number },
  output: { faces_per_frame: [{ frame: number, boxes: BoundingBox[] }] }
}
```
**Implementación (TS → MediaPipe Tasks for Web):** corre en el browser, el agente en TS orquesta las llamadas.

#### 7.12. `auto_reframe`
```typescript
{
  name: "auto_reframe",
  description: "Convert video to a different aspect ratio tracking the main subject",
  input: { 
    video_id: string, 
    target_ratio: "9:16" | "1:1" | "4:5" | "16:9",
    tracking: "face" | "object" | "center"
  },
  output: { reframed_clip_id: string }
}
```

#### 7.13. `detect_beats`
```typescript
{
  name: "detect_beats",
  description: "Detect musical beats in an audio track",
  input: { audio_id: string },
  output: { beats: number[], bpm: number }
}
```
**Implementación (TS → Essentia.js):** corre en el browser via Web Worker para no bloquear el main thread.

### Tier 4 — Inteligencia de alto nivel

#### 7.14. `suggest_highlights`
```typescript
{
  name: "suggest_highlights",
  description: "AI-powered analysis to find the most engaging moments in a video",
  input: { 
    video_id: string, 
    target_duration: number,
    criteria?: "energy" | "humor" | "information" | "visual"
  },
  output: {
    highlights: [{
      start: number,
      end: number,
      score: number,
      reason: string
    }]
  }
}
```
**Este es el pipeline más impresionante.** Combina:
- Transcripción (palabras emocionales)
- Análisis de audio (picos de volumen, risas)
- Análisis de escena (cambios, caras, acción)
- LLM que rankea todo

#### 7.15. `remove_filler_words`
```typescript
{
  name: "remove_filler_words",
  description: "Remove 'um', 'uh', 'like', and other filler words from video",
  input: { video_id: string, language?: string },
  output: { cuts_made: number, total_time_saved: number }
}
```

---

## 8. Flujos de usuario end-to-end

### Flujo 1: Reel automático

```
Usuario sube video de 5 min → "hazme un reel vertical de 30s con 
los mejores momentos y subtítulos amarillos"
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ Agente razona:                                            │
│ "Necesito: analizar video, cortar momentos, reframe,     │
│  subtítulos"                                              │
└──────────────────────────────────────────────────────────┘
         │
         ▼
1. transcribe_video() ────────► transcripción con timestamps
         │
         ▼
2. detect_scenes() ───────────► 12 escenas identificadas
         │
         ▼
3. suggest_highlights(30s) ───► Top 5 momentos rankeados
         │
         ▼
4. Para cada highlight:
   - split({ times: [start, end] })
         │
         ▼
5. concat_segments(ids) ──────► Reel de ~30s
         │
         ▼
6. auto_reframe("9:16", face) ► Vertical con tracking
         │
         ▼
7. generate_subtitles(tiktok, yellow) ► Subs estilizados
         │
         ▼
Preview renderizado → usuario aprueba → export final
```

### Flujo 2: Pregunta abierta

```
Usuario: "¿En qué parte se ve mejor mi iluminación?"
         │
         ▼
Agente llama: watch_video(question="best lighting")
         │
         ▼
Gemini 2.5 / Qwen ve el video, responde:
"Entre 0:23 y 0:31 hay buena iluminación frontal natural. 
Después de 2:45 la luz se vuelve amarillenta."
         │
         ▼
Agente presenta respuesta + timestamps + screenshots
```

### Flujo 3: Edición conversacional iterativa

```
Usuario: "hazme subtítulos"
Agente: generate_subtitles(default) → listo

Usuario: "más grandes y amarillos"
Agente: actualiza estilo del subtitle_track_id existente

Usuario: "quita la parte donde me equivoco"
Agente: watch_video("where does the person mess up?")
         → identifica timestamp 1:23-1:31
         → pide confirmación
         → split({ times: [start, end] }) + delete_timeline_elements
```

---

## 9. Plan de desarrollo (Scrum)

### 9.1. Infraestructura habilitadora inicial (antes de la primera feature)

Antes de implementar la primera feature de producto visible (`transcribe_video`), el equipo necesita montar una **infraestructura mínima habilitadora**. Esta capa no entrega todavía el valor completo al usuario, pero crea el canal por el cual el agente puede operar dentro del editor. Sin esto, cualquier tool real quedaría acoplada, improvisada o desconectada de la UI.

#### Objetivo

Tener un **vertical slice técnico mínimo** donde:

- el usuario puede escribir en un panel de chat,
- el frontend puede enviar ese mensaje al backend,
- existe un orquestador básico que recibe la intención,
- existe un registro de tools desacoplado,
- el agente conoce cuál es el video activo del editor,
- y una tool mock o real puede devolver un resultado visible en la interfaz.

#### Componentes de esta infraestructura

**1. Superficie de interacción (UI mínima de chat)**
- `ChatPanel`
- `MessageList`
- `InputArea`
- estado de loading, error y mensajes

**2. Canal cliente-servidor**
- `app/api/agent/chat/route.ts`
- contrato claro de request/response
- streaming opcional al inicio, respuesta simple como mínimo

**3. Orquestador básico del agente**
- `agent/orchestrator.ts`
- recibe mensajes + contexto actual
- decide entre respuesta directa o ejecución de una tool
- puede arrancar con lógica simple antes del tool calling completo por LLM

**4. Registro y contrato de tools**
- `agent/tools/index.ts`
- interfaz común para tools
- schema de input/output
- executor desacoplado por tool

**5. Capa de providers**
- interfaces abstractas (`TranscriptionProvider`, `VisionProvider`, `LLMProvider`)
- factories por ambiente
- posibilidad de usar mock/local/cloud sin cambiar el resto del código

**6. Estado agéntico y conversacional**
- `chatStore`
- `agentStore`
- mensajes, estado de ejecución, resultados y errores

**7. Integración con el editor actual**
- lectura del video seleccionado o activo
- validación de que exista media cargada
- paso de `video_id` o referencia equivalente a las tools

**8. Tipos y contratos compartidos**
- mensajes de chat
- tool calls
- tool results
- transcript segments
- estado de ejecución del agente

#### Entregable esperado de esta fase

Al final de esta fase, el equipo debe poder demostrar:

> “Escribo en el panel de chat, el mensaje viaja al endpoint del agente, el orquestador procesa la intención y devuelve una respuesta visible en la UI usando una tool mock o una tool real simple.”

Esto no reemplaza la primera feature de producto; la **habilita**.

### 9.2. Equipo y roles

- **Scrum Master:** coordina reuniones, remueve bloqueos
- **Product Owner:** prioriza backlog, dueño de la visión
- **Dev Frontend (2):** UI, NeuralCut, panel de chat
- **Dev Backend/IA (1-2):** agente (TS), tools, capa de proveedores

### 9.3. Sprints propuestos (asumiendo ~14 semanas)

| Sprint | Duración | Objetivo | Entregable |
|---|---|---|---|
| **0** | 1 semana | Setup + aprendizaje | NeuralCut corriendo local. Ollama + Qwen funcionando. Cada dev hizo "hola mundo" con APIs. |
| **1** | 1 semana | Empatizar | 8-10 entrevistas a creadores de contenido. Mapa de empatía. Declaración del problema validada. |
| **2** | 1 semana | Ideación + diseño | Wireframes del panel de chat. Diseño de la capa de abstracción. Decisión de scope de tools. |
| **3** | 1 semana | Infraestructura habilitadora | ChatPanel mínimo funcional, `chatStore`/`agentStore`, endpoint `/api/agent/chat`, orquestador básico, registro de tools, tipos compartidos, integración con video activo. |
| **4** | 1 semana | Primer vertical slice real | `transcribe_video` conectada end-to-end con provider real o local, respuesta visible en chat y timestamps persistidos en estado. |
| **5** | 1 semana | Tier 1 tools | detect_silences, detect_scenes, split, concat_segments sobre la base ya creada. |
| **6** | 1 semana | Video understanding | watch_video + take_screenshot + describe_scene. Primera demo "wow". |
| **7** | 1 semana | Creative tools | generate_subtitles, apply_lut, detect_faces. |
| **8** | 1 semana | Reframe + beats | auto_reframe (MediaPipe), detect_beats (Essentia). |
| **9** | 1 semana | Pipeline inteligente | suggest_highlights + remove_filler_words. |
| **10** | 1 semana | Refinamiento UX | Streaming de respuestas, aprobaciones inline, undo/redo agéntico. |
| **11** | 1 semana | Testing con usuarios | 5-10 sesiones de usability testing. Ajustes. |
| **12** | 1 semana | Performance + deploy | Optimización, caching, deploy a Vercel. |
| **13** | 1 semana | Preparación feria | Videos de ejemplo pre-procesados, afiche, guión de demo. |
| **14** | 1 semana | Buffer + Post Mortem | Buffer para imprevistos. Reunión Post Mortem. |

### 9.4. Backlog priorizado (primeras historias)

**Infraestructura habilitadora (antes de Sprint 4):**
- Como usuario, veo un panel de chat integrado dentro del editor
- Como usuario, puedo enviar un mensaje y recibir una respuesta visible del agente
- Como sistema, el agente conoce cuál es el video activo del proyecto
- Como sistema, las tools comparten un contrato estable de entrada y salida
- Como equipo, podemos alternar entre providers mock, locales y cloud sin cambiar la lógica de negocio

**Must-have actualizado:**
- Como usuario, puedo chatear con un agente conectado a un provider real (`LLM_PROVIDER`).
- Como sistema, puedo alternar entre providers (`gemini`, `openai-compatible`) sin cambiar el core del agente.
- Como agente, puedo listar assets del proyecto y saber cuáles están en el timeline.
- Como agente, puedo cargar un asset con Gemini usando `load_asset_context` para entenderlo multimodalmente.
- Como usuario, puedo preguntarle al agente sobre el contenido del video después de que el asset esté cargado en contexto.
- Como usuario, puedo pedir cortes básicos por timestamp usando `split`.
- Como usuario, puedo pedir texto visual básico usando `add_text`.

**Should-have actualizado:**
- Como usuario, puedo insertar assets existentes al timeline con `add_media_to_timeline`.
- Como usuario, puedo borrar elementos específicos con `delete_timeline_elements`.
- Como usuario, puedo mover elementos existentes con `move_timeline_elements`.
- Como usuario, puedo ajustar cuánto dura un elemento existente con `update_timeline_element_timing`.
- Como usuario, puedo ajustar volumen con `set_volume`.
- Como usuario, puedo agregar stickers con `add_sticker`.
- Como usuario, puedo aplicar efectos existentes con `apply_effect` (inicialmente `blur`).

**Nice-to-have (Sprint 9+):**
- Como usuario, puedo deshacer acciones del agente
- Como usuario, el agente me muestra un preview antes de aplicar cambios grandes
- Como usuario, comparto el proyecto por URL
- Como usuario, puedo referenciar assets con `@asset`.
- Como sistema, cacheo referencias Gemini de assets cargados para evitar re-upload.

---

## 10. Consideraciones de performance y costos

### 10.1. Performance esperado

| Operación | Tiempo esperado | Optimización |
|---|---|---|
| Transcripción Whisper API (5 min video) | 15-30s | Cachear resultado |
| Gemini 2.5 Flash análisis (2 min video) | 10-20s | Context caching |
| Qwen2.5-VL local (2 min video) | 30-60s | Quantization 4-bit |
| Corte + export FFmpeg.wasm (30s clip) | 10-20s | WebCodecs cuando sea posible |
| Auto-reframe (1 min) | 20-40s | Process en Web Worker |

### 10.2. Costos de APIs (estimado para todo el semestre)

| Servicio | Uso estimado | Costo estimado |
|---|---|---|
| Whisper API | 50 horas video | $18 |
| Gemini 2.5 Flash | ~500 análisis | $15-30 |
| Claude Opus | ~2000 mensajes | $20-40 |
| **Total** | | **~$50-90 USD** |

**Mitigaciones:**
- Usar modelos locales durante desarrollo (90% del tiempo)
- Context caching en Gemini (subir video una vez, preguntar muchas)
- Aprovechar créditos académicos (Anthropic, Google ofrecen)
- Free tier generoso de Google AI Studio

### 10.3. Límites técnicos

- **Tamaño máximo de video en browser:** ~500MB (limitación de memoria WebAssembly)
- **Duración máxima recomendada:** 10 minutos por video
- **Exports simultáneos:** 1 por pestaña
- **Contexto LLM:** ~200k tokens suficientes para proyectos típicos

---

## 11. Estrategia de demo para feria

### 11.1. Setup del stand

- **Monitor grande** (idealmente 27"+) mostrando la app en Chrome
- **Laptop secundaria** corriendo Qwen local como fallback
- **2-3 celulares** listos para subir videos espontáneamente
- **Videos pre-procesados** listos para casos demo "seguros"
- **Afiche** con arquitectura visual + QR al URL live
- **Hoja de FAQ técnica** para jurados técnicos

### 11.2. Casos demo (por nivel de engagement)

#### Quick (30s — para visitantes casuales)
> "Mira, le hablas y edita". Sube video de 30s pre-cargado → "ponme subtítulos amarillos" → listo.

#### Medium (2 min — para visitantes interesados)
> "Dame tu celular" → graban 30s → "hazme un reel vertical con los mejores momentos" → entrega.

#### Deep (5 min — para jurados técnicos)
> Explicar: arquitectura, capa de abstracción (mostrar cambio local↔cloud en vivo), tool calling, video understanding.

### 11.3. Respuestas a preguntas esperadas del jurado

**"¿Por qué forkear OpenCut en vez de hacerlo desde cero?"**
> Porque el valor diferencial no está en rehacer el timeline, está en el agente. Forkear nos permitió enfocar el 80% del esfuerzo en lo innovador. Es exactamente la misma decisión que Cursor tomó con VSCode. El fork se llama NeuralCut y estamos migrando lógica a Rust para performance.

**"¿Qué pasa si las APIs fallan?"**
> Diseñamos una capa de abstracción de proveedores. Puedo alternar entre Gemini en la nube y Qwen2.5-VL local sin cambiar código, solo una variable de entorno. [Demostrar en vivo si hay tiempo.]

**"¿Esto no existe ya?"**
> Hay piezas aisladas: Descript edita por transcripción, Opus Clip hace clips automáticos, Runway hace efectos. Nadie tiene un agente conversacional completo sobre un editor tradicional. Es la diferencia entre "feature de IA" y "agente autónomo".

**"¿Cómo se monetiza?"**
> No es foco del proyecto académico, pero el modelo natural sería freemium: local y funciones básicas gratis, APIs premium con suscripción. El usuario objetivo (creadores pequeños) ya paga $10-20/mes por herramientas.

**"¿Cuánto cuesta procesarar un video?"**
> Entre $0.05 y $0.15 por video de 5 minutos usando APIs de producción. Local es gratis pero más lento.

---

## 12. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Curva de aprendizaje del codebase de NeuralCut | Alta | Alto | Sprint 0 dedicado exclusivamente a exploración |
| APIs fallan durante demo | Media | Alto | Fallback a modelos locales (capa de abstracción) |
| Videos grandes crashean el browser | Alta | Medio | Limitar a <10 min, mostrar warnings, pre-comprimir |
| Modelo local muy lento en laptops del equipo | Media | Medio | Quantization 4-bit, usar versión 3B en lugar de 7B |
| Costos de APIs se salen de presupuesto | Baja | Medio | Dashboard de monitoring, límites por usuario, caching agresivo |
| Alguien del equipo se enferma/sale | Media | Alto | Documentación exhaustiva, pair programming |
| Demasiado scope | Alta | Alto | Scope definido por tiers — tier 1 es MVP, tier 4 es stretch |
| Tool calling poco confiable con modelos locales | Media | Medio | Testear con Gemini/Claude en demo, fallback a respuestas pre-armadas |

---

## 13. Apéndices técnicos

### A. Setup de desarrollo paso a paso

```bash
# 1. Clonar NeuralCut (nuestro fork)
git clone <repo-url> NeuralCut
cd NeuralCut

# 2. Instalar dependencias
bun install

# 3. Configurar entorno local
cp apps/web/.env.example apps/web/.env.local

# 4. Levantar Docker (Postgres + Redis)
docker compose up -d

# 5. Correr la app (monorepo con Turbo)
bun dev:web
# → http://localhost:3000

# 6. (Opcional) Instalar Ollama para modelos locales
# Mac: brew install ollama
# Linux: curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5vl:7b
ollama pull qwen3:8b        # para orquestador liviano
```

### B. Estructura de carpetas propuesta

```
NeuralCut/
├── rust/                                    # Procesamiento pesado (CPU-bound)
│   ├── crates/
│   │   ├── bridge/                          # Puente Rust ↔ JS (WASM bindings)
│   │   ├── compositor/                      # Composición de video
│   │   ├── effects/                         # Filtros y efectos
│   │   ├── gpu/                             # Aceleración GPU
│   │   ├── masks/                           # Mascaramiento
│   │   └── time/                            # Manipulación de tiempo
│   └── wasm/                                # WASM build target
│
├── apps/
│   ├── web/                                 # UI shell + agente (Next.js 16 + React 19)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── api/
│   │   │   │   │   ├── agent/chat/route.ts  # NUEVO: endpoint del agente (streaming)
│   │   │   │   │   └── tools/               # NUEVO: endpoints de tools
│   │   │   │   │       ├── transcribe/route.ts
│   │   │   │   │       ├── analyze/route.ts
│   │   │   │   │       └── highlights/route.ts
│   │   │   │   └── editor/                  # UI del editor (existente)
│   │   │   │
│   │   │   ├── components/
│   │   │   │   ├── chat/                    # NUEVO: panel de chat
│   │   │   │   │   ├── ChatPanel.tsx
│   │   │   │   │   ├── MessageList.tsx
│   │   │   │   │   ├── InputArea.tsx
│   │   │   │   │   └── ApprovalPrompt.tsx
│   │   │   │   ├── timeline/                # existente
│   │   │   │   └── preview/                 # existente (NO TOCAR)
│   │   │   │
│   │   │   ├── agent/                       # NUEVO: lógica del agente (TS)
│   │   │   │   ├── orchestrator.ts          #   loop principal: LLM → tool → LLM
│   │   │   │   ├── tools/                   #   definiciones de tools + ejecutores
│   │   │   │   │   ├── index.ts             #     registro de todas las tools
│   │   │   │   │   ├── transcribe.ts        #     → llama TranscriptionProvider
│   │   │   │   │   ├── detectSilences.ts    #     → Web Audio API o Rust (WASM)
│   │   │   │   │   ├── detectScenes.ts      #     → FFmpeg o Rust (WASM)
│   │   │   │   │   ├── cutSegment.ts        #     → Zustand store manipulation
│   │   │   │   │   ├── watchVideo.ts        #     → llama VisionProvider
│   │   │   │   │   ├── generateSubtitles.ts #     → TranscriptionProvider + render
│   │   │   │   │   └── ...
│   │   │   │   └── prompts/
│   │   │   │       └── system.ts            #     system prompt template
│   │   │   │
│   │   │   ├── providers/                   # NUEVO: capa de abstracción
│   │   │   │   ├── vision/
│   │   │   │   │   ├── types.ts
│   │   │   │   │   ├── gemini.ts
│   │   │   │   │   ├── qwen-local.ts
│   │   │   │   │   └── index.ts             # factory
│   │   │   │   ├── transcription/
│   │   │   │   │   ├── whisper-api.ts
│   │   │   │   │   ├── whisper-local.ts
│   │   │   │   │   └── index.ts
│   │   │   │   └── llm/
│   │   │   │       ├── claude.ts
│   │   │   │       ├── openai.ts
│   │   │   │       ├── ollama.ts
│   │   │   │       └── index.ts
│   │   │   │
│   │   │   ├── stores/                      # extiende stores existentes
│   │   │   │   ├── ... (existentes)
│   │   │   │   ├── chatStore.ts             # NUEVO
│   │   │   │   └── agentStore.ts            # NUEVO
│   │   │   │
│   │   │   └── lib/
│   │   │       ├── ffmpeg.ts                # wrapper sobre ffmpeg.wasm
│   │   │       ├── mediabunny.ts            # wrapper sobre MediaBunny
│   │   │       └── video-utils.ts
│   │   │
│   │   └── package.json
│   │
│   └── desktop/                             # UI shell (GPUI, futuro)
│
├── package.json                             # workspace root
├── turbo.json
└── docker-compose.yml
```

**Regla de separación Rust ↔ TypeScript:**

- **`rust/`** = CPU-bound: composición, efectos, GPU, detección de silencios/escenas, face tracking, beat detection. Compilado a WASM, llamado desde TS cuando se necesita poder de cálculo.
- **`apps/web/src/agent/`** = I/O-bound: orquestación del LLM, tool calling, streaming, manejo de estado del chat, definición de tools, provider abstraction. Todo lo que implica llamar APIs, parsear JSON, o manipular el Zustand store va acá.
- **`apps/web/src/providers/`** = integración con APIs externas (Gemini, Claude, Whisper, Ollama). Nunca en Rust porque WASM no tiene networking nativo.
- **`apps/web/src/components/`** = UI pura. Solo renderiza lo que los stores dictan.

### C. System prompt del agente (borrador)

```
Eres un asistente experto en edición de video. Tu trabajo es entender 
lo que el usuario quiere hacer con su video y usar las herramientas 
disponibles para ejecutarlo.

PRINCIPIOS:
1. Antes de hacer cambios grandes, muestra un preview o pide confirmación
2. Si no tienes suficiente contexto, usa watch_video o describe_scene
3. Encadena tools lógicamente: primero analiza, después modifica
4. Reporta siempre qué hiciste y por qué

CONTEXTO ACTUAL DEL PROYECTO:
- Videos cargados: {media_list}
- Timeline actual: {timeline_summary}
- Duración total: {total_duration}

HERRAMIENTAS DISPONIBLES:
{tools_schema}

Cuando el usuario pida algo ambiguo, pregunta. Cuando algo sea destructivo,
confirma. Cuando puedas hacerlo con una sola tool, no lo compliques.
```

### D. Ejemplo de integración con Ollama (modo local)

```typescript
// providers/llm/ollama.ts
import type { LLMProvider, Message, Tool, ChatChunk } from './types';

export class OllamaLLMProvider implements LLMProvider {
  constructor(private config: { endpoint: string; model: string }) {}

  async *chat(
    messages: Message[],
    tools?: Tool[]
  ): AsyncGenerator<ChatChunk> {
    const response = await fetch(`${this.config.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        tools,
        stream: true
      })
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(l => l.trim());
      
      for (const line of lines) {
        const data = JSON.parse(line);
        yield {
          content: data.message?.content || '',
          toolCalls: data.message?.tool_calls,
          done: data.done
        };
      }
    }
  }
}
```

### E. Recursos y referencias

- **OpenCut:** https://github.com/OpenCut-app/OpenCut
- **Qwen2.5-VL:** https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct
- **Gemini Video Understanding:** https://ai.google.dev/gemini-api/docs/video-understanding
- **FFmpeg.wasm:** https://github.com/ffmpegwasm/ffmpeg.wasm
- **MediaBunny:** https://mediabunny.dev
- **MediaPipe Tasks for Web:** https://developers.google.com/mediapipe/solutions
- **Essentia.js:** https://mtg.github.io/essentia.js/
- **Anthropic API:** https://docs.anthropic.com
- **Ollama:** https://ollama.com

---

## Cierre

Este documento es un **mapa de ruta**, no un contrato rígido. El scope se ajustará según el progreso real de cada sprint. La regla es: **tier 1 es innegociable, tier 2 es el objetivo, tier 3-4 son bonus.**

El éxito del proyecto se mide en tres ejes:

1. **¿Funciona?** El MVP ejecuta al menos 8 tools end-to-end.
2. **¿Impresiona?** El demo de feria genera el "wow" en visitantes.
3. **¿Aprendimos?** Aplicamos Design Thinking + Scrum de forma real, no de fachada.
