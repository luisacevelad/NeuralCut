# Agent Context Bridge Specification

## Purpose

Defines the contracts and adapter that expose the editor's active media/video state to the agent orchestrator. This bridge is the ONLY sanctioned path by which the agent reads editor state — it prevents direct coupling between `agent/` and `EditorCore` internals.

## Requirements

### Requirement: AgentContext Contract

The system SHALL define `AgentContext` as `{ projectId: string | null, activeSceneId: string | null, mediaAssets: MediaSummary[], playbackTimeMs: number }` where `MediaSummary { id, name, type, duration }`. The orchestrator MUST receive this context on every `run()` call. The context MUST be serializable (JSON-safe) so it can be forwarded to the API proxy.

#### Scenario: Context includes active media

- GIVEN the project has two loaded video assets
- WHEN the context is assembled
- THEN `mediaAssets` contains two entries with `id`, `name`, `type: "video"`, and `duration`

#### Scenario: Context is JSON-serializable

- GIVEN an `AgentContext` instance with populated `mediaAssets`
- WHEN `JSON.stringify(context)` is called
- THEN it produces valid JSON without circular references

### Requirement: EditorContext Adapter

The system SHALL provide an `EditorContextAdapter` with a single method `getContext(): AgentContext`. This adapter MUST read from `EditorCore.media.getAssets()`, `EditorCore.project.getActiveOrNull()`, `EditorCore.scenes.getActiveSceneOrNull()`, and `EditorCore.playback.getCurrentTime()` to populate the context. The data mapping logic is extracted into a pure `buildContextFromEditorState()` function (in `context-mapper.ts`) for WASM-free testability. The adapter SHALL NOT expose any `EditorCore` manager directly — it returns a plain `AgentContext` object.

#### Scenario: Active media populated from editor

- GIVEN `EditorCore` has a project loaded with ID `"proj-1"` and two media assets
- WHEN `adapter.getContext()` is called
- THEN it returns `{ projectId: "proj-1", mediaAssets: [summary1, summary2], activeSceneId, playbackTimeMs }`

#### Scenario: No project loaded

- GIVEN `EditorCore.project.getActiveOrNull()` returns `null`
- WHEN `adapter.getContext()` is called
- THEN it returns `{ projectId: null, activeSceneId: null, mediaAssets: [], playbackTimeMs: 0 }`

### Requirement: Context Injection into System Prompt

The system SHALL provide a `buildSystemPrompt(context: AgentContext)` function that produces a system prompt string including the media summary AND guidance about available tools. When `mediaAssets` is empty, the prompt MUST still be valid but indicate no media loaded. The prompt MUST instruct the LLM that it can call tools from a known set (currently `transcribe_video`) and that it should respond in plain text when no tool is needed. The system prompt template MUST be separate from the orchestrator logic and MUST be consumable by the server route (i.e., a pure function with no client-only dependencies).

#### Scenario: Prompt includes media context and tool guidance

- GIVEN `AgentContext` with `mediaAssets: [{ id: "v1", name: "clip.mp4", type: "video", duration: 30 }]`
- WHEN `buildSystemPrompt(context)` is called
- THEN the returned string contains "clip.mp4", "video", and references "transcribe_video" as an available tool

#### Scenario: Prompt without media

- GIVEN `AgentContext` with `mediaAssets: []`
- WHEN `buildSystemPrompt(context)` is called
- THEN the returned string is valid, contains "No media assets loaded", and still references available tools

#### Scenario: Server-side consumption

- GIVEN `buildSystemPrompt` is imported in the API route
- WHEN the route calls `buildSystemPrompt(context)`
- THEN it returns a string without importing any client-only modules (no `EditorCore`, no WASM, no browser APIs)

### Requirement: No Direct EditorCore Access from Agent

The `apps/web/src/agent/` directory MUST NOT import from `apps/web/src/core/`. All editor state access MUST go through `EditorContextAdapter`. This constraint ensures the agent layer remains decoupled from editor internals.

#### Scenario: Agent module imports adapter, not core

- GIVEN any file under `apps/web/src/agent/`
- WHEN the module is analyzed for imports
- THEN it imports from `EditorContextAdapter` (or a re-export barrel)
- AND it does NOT import directly from `apps/web/src/core/`
