# Exploration: Infraestructura Habilitadora — Fase 1 del Agente Conversacional

## Current State

### Editor Architecture

NeuralCut's editor is built around a **singleton `EditorCore`** (`apps/web/src/core/index.ts`) that owns 12 managers accessed via `EditorCore.getInstance()`:

- `project` — active project (`TProject`), CRUD, load/save, export
- `media` — loaded media assets (`MediaAsset[]`), add/remove
- `scenes` — scene list (`TScene[]`), active scene, bookmarks
- `timeline` — track mutations (add/remove/move elements)
- `playback` — playhead, play/pause, seek
- `command` — undo/redo with `BaseCommand` pattern
- `selection` — selected elements on canvas
- `renderer` — GPU/canvas rendering
- `save` — auto-save to IndexedDB
- `audio` — audio analysis
- `clipboard` — copy/paste
- `diagnostics` — runtime diagnostics

React components subscribe via `useEditor(selector)` which uses `useSyncExternalStore` over all manager subscriptions.

### How the Active Video Is Identified

1. `EditorCore.project.getActive()` returns `TProject` with `metadata.id` (the `project_id` from the URL)
2. `EditorCore.media.getAssets()` returns all `MediaAsset[]` loaded for that project
3. Each `MediaAsset` has: `id`, `name`, `type` ("image"|"video"|"audio"), `file`, `url`, `duration`, `width`, `height`, `fps`
4. The active scene's main video track: `scenes.getActiveSceneOrNull()?.tracks.main.elements[0]` references a `VideoElement` with `mediaAssetId`
5. **For the agent**: the simplest context is the project's loaded video assets. The agent can query by `mediaAssetId`.

### Panel Layout

The editor layout (`apps/web/src/app/editor/[project_id]/page.tsx`) uses `ResizablePanelGroup` (shadcn/ui) in a 4-panel arrangement:

```
┌──────────┬──────────────────────┬──────────────┐
│  Assets  │       Preview        │  Properties  │
│  Panel   │                      │    Panel     │
│  (25%)   │       (50%)          │   (25%)      │
├──────────┴──────────────────────┴──────────────┤
│                  Timeline (50%)                  │
└─────────────────────────────────────────────────┘
```

`PanelSizes` currently defines: `tools`, `preview`, `properties`, `mainContent`, `timeline`.

**ChatPanel integration**: The most natural placement is replacing/augmenting the **Properties panel** slot — properties is context-dependent and the chat panel could share that space with a tab toggle. Alternatively, it could be a **new 5th panel** that slides in from the right.

### Existing Stores

All Zustand stores at `apps/web/src/stores/`:
- `editor-store.ts` — init/ready state
- `panel-store.ts` — resizable panel sizes (persisted)
- `timeline-store.ts` — snap/ripple toggles (persisted)
- `assets-panel-store.tsx` — active tab in assets panel (persisted)
- `preview-store.ts` — guides, overlays (persisted)
- `properties-store.ts` — properties panel state
- Plus keybindings, sounds, stickers

**Pattern**: `create<State>()(persist((set) => ({...}), { name: "...", partialize: ... }))` with explicit `set` calls.

### Existing Transcription

`apps/web/src/services/transcription/service.ts` — Web Worker-based Whisper transcription. Types in `apps/web/src/lib/transcription/types.ts`:
- `TranscriptionSegment { text, start, end }`
- `TranscriptionResult { text, segments, language }`
- `TranscriptionStatus`, `TranscriptionProgress`, `TranscriptionModelId`

**This is a direct integration point** for the agent's `transcribe_video` tool — the agent can reuse the existing service.

### Existing API Routes

Only 4 simple routes exist at `apps/web/src/app/api/`:
- `auth/` — authentication
- `feedback/route.ts` — simple POST
- `health/route.ts` — `export async function GET()`
- `sounds/` — sound search

No agent/chat routes exist yet. Pattern is standard Next.js App Router route handlers.

### Registry Pattern

`apps/web/src/lib/registry.ts` has a generic `DefinitionRegistry<TKey, TDefinition>` with `register()`, `get()`, `getAll()`. Used for effects and masks. **This is the exact pattern to reuse for the tool registry.**

### Command System

`apps/web/src/lib/commands/` has a command pattern (`BaseCommand` with `execute`/`undo`). Used for timeline mutations, scene changes, project settings, media operations. **Agent tools that modify the timeline should go through `CommandManager`** to preserve undo/redo.

---

## Affected Areas

- `apps/web/src/stores/` — new `chatStore.ts` and `agentStore.ts`
- `apps/web/src/app/api/agent/chat/route.ts` — new API route (to create)
- `apps/web/src/components/editor/panels/chat/` — new `ChatPanel`, `MessageList`, `InputArea`
- `apps/web/src/app/editor/[project_id]/page.tsx` — layout modification to include ChatPanel
- `apps/web/src/stores/panel-store.ts` — new `chat` panel size entry
- `apps/web/src/lib/panels/layout.ts` — default config for chat panel
- `apps/web/src/agent/` — new directory for orchestrator, tools, types, prompts
- `apps/web/src/lib/registry.ts` — reuse for tool registry
- `apps/web/src/services/transcription/service.ts` — integration point for `transcribe_video` tool
- `apps/web/src/core/managers/` — agent may need to read from `media`, `scenes`, `project` managers

---

## Approaches

### 1. Thin Vertical Slice — Mock Everything, Wire End-to-End

Build the minimal pipeline: UI → API → Orchestrator → MockTool → Response → UI. No real LLM, no streaming, one mock tool.

- **Pros**: Fastest to demo, validates the full pipeline before adding complexity, team learns the architecture by doing
- **Cons**: Doesn't test real LLM integration, mock may give false confidence
- **Effort**: Low (3-5 dev-days)

### 2. Thin Slice + Real LLM (Ollama Local)

Same as #1 but the orchestrator calls a real local LLM (Ollama Qwen3-8B) for responses. Tool calling mocked.

- **Pros**: Tests the provider abstraction from day one, validates streaming
- **Cons**: Requires Ollama setup, LLM latency in dev loop, provider bugs can distract
- **Effort**: Medium (5-7 dev-days)

### 3. Full Infrastructure First

Build all abstractions (providers, tool registry, orchestrator, streaming, error recovery) before any UI.

- **Pros**: Clean architecture, no rework
- **Cons**: Slow to demo, no user feedback until everything is wired, risk of overengineering
- **Effort**: High (10-14 dev-days)

---

## Recommendation

**Approach 1 — Thin Vertical Slice with Mocks**. The propuesta_técnica explicitly says Sprint 3 should deliver the infraestructura habilitadora in 1 week. A thin slice that wires the full pipeline with one mock tool is the fastest way to:

1. Validate the architecture (stores, API route, orchestrator, tool registry)
2. Give the team a working demo to iterate on
3. Establish contracts (types) that all future tools implement
4. Let UI and backend devs work in parallel afterward

**The real LLM (Approach 2) comes in Sprint 4** when `transcribe_video` is connected to the existing Whisper service.

### Recommended Thin Scope (what goes in the first slice)

| Component | Location | Real or Mock |
|-----------|----------|-------------|
| Types: `ChatMessage`, `ToolCall`, `ToolResult`, `ExecutionStatus` | `apps/web/src/agent/types.ts` | **Real** — these are contracts |
| `chatStore` | `apps/web/src/stores/chatStore.ts` | **Real** — messages, loading, error |
| `agentStore` | `apps/web/src/stores/agentStore.ts` | **Real** — execution status, active tool, context |
| Tool registry + `ToolDefinition` interface | `apps/web/src/agent/tools/` | **Real** — registry pattern, one mock tool |
| Orchestrator (minimal) | `apps/web/src/agent/orchestrator.ts` | **Mock** — echo response + tool resolution |
| `/api/agent/chat` route | `apps/web/src/app/api/agent/chat/route.ts` | **Real** — POST handler, context extraction |
| `ChatPanel`, `MessageList`, `InputArea` | `apps/web/src/components/editor/panels/chat/` | **Real** — functional UI |
| Panel layout integration | `apps/web/src/app/editor/[project_id]/page.tsx` | **Real** — toggleable chat panel |
| Provider abstraction | `apps/web/src/agent/providers/` | **Stub** — interfaces only, mock implementation |
| System prompt template | `apps/web/src/agent/prompts/system.ts` | **Real** — basic template with context injection |

### Architecture Decision: Where Does the Agent Live?

Per the propuesta_técnica Section 5.1.1, the agent orchestration is **I/O-bound TypeScript** in `apps/web/src/agent/`. This does NOT violate the AGENTS.md rule ("business logic in rust/") because:

- The agent is an **integration layer** — it orchestrates external API calls and coordinates existing tools
- It does NOT contain algorithms or data transformations
- Heavy processing (video analysis, detection) that the agent triggers still runs through Rust/WASM
- The Zustand store manipulations it performs (cut, concat) go through the existing `CommandManager`

If in the future parts of the orchestrator become complex enough to warrant Rust (e.g., planning algorithms), they can migrate then. YAGNI for now.

### Chat Panel Placement Recommendation

**Tabbed panel alongside Properties** (sharing the right panel slot). Rationale:
- Doesn't change the 4-panel layout that users already know
- Properties panel is context-dependent and often underused
- A tab toggle ("Properties" | "Chat") at the top of the right panel is simple
- The `PanelSizes` type stays the same; we add a UI-level toggle in the right panel

---

## Risks

1. **Architecture tension with AGENTS.md** — The agent code lives in `apps/web/src/agent/` which is technically "the UI shell". The team must maintain the discipline that `agent/` contains only orchestration/I/O, never algorithms. If logic drifts into `agent/tools/`, it should move to `rust/`. This needs a clear convention documented.

2. **EditorCore singleton coupling** — The agent needs to read from `EditorCore.media` and `EditorCore.scenes` to know the active video. This creates coupling between the agent layer and the editor internals. Mitigate with a thin `EditorContext` adapter that extracts only what the agent needs.

3. **No streaming in v1** — A non-streaming response will feel sluggish. Users expect chat to stream. Mitigate by designing the types to support streaming from day one, even if v1 uses a simple JSON response.

4. **State synchronization** — When the agent modifies the timeline (via `CommandManager`), the chat store needs to reflect the result. Two separate Zustand stores + EditorCore managers = three sources of truth. Mitigate with clear ownership: `chatStore` owns messages, `agentStore` owns execution status, `EditorCore` owns project data.

5. **Tool execution in API route vs client** — Tools that modify the timeline (cut, concat) need access to `EditorCore` which runs client-side. The API route can't access it. Solution: the orchestrator runs **client-side**, and the API route is only for LLM calls. The client-side orchestrator receives the LLM response, resolves tool calls, and executes them locally. This is the correct architecture — the server is just an LLM proxy.

6. **`propuesta_tecnica.md` scope creep** — The proposal lists 15 tools across 4 tiers. The team must resist building tool scaffolding beyond what the mock requires. The registry should support 1 tool in v1, not pre-scaffold 15.

---

## Ready for Proposal

**Yes.** The exploration has identified:
- Clear placement for every component
- The exact integration points with existing code
- The tension between AGENTS.md and propuesta_técnica.md (resolved: agent is I/O orchestration, not business logic)
- A thin scope that can be delivered in Sprint 3 (1 week)

**Next**: The orchestrator should run `sdd-propose` with the recommended thin scope to create a formal proposal for this change.
