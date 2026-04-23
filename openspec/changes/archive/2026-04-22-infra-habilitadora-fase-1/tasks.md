# Tasks: Infra Habilitadora — Fase 1

## Phase 1: Foundation — Types & Tool Registry

- [x] 1.1 Create `apps/web/src/agent/types.ts` — export `ChatMessage`, `ToolCall`, `ToolResult`, `AgentContext`, `ExecutionState`, `ToolDefinition` per design contracts
- [x] 1.2 Create `apps/web/src/agent/tools/registry.ts` — instantiate `DefinitionRegistry<string, ToolDefinition>` from `@/lib/registry`, export singleton `toolRegistry`
- [x] 1.3 Create `apps/web/src/agent/tools/mock.tool.ts` — `echo_context` tool returning context summary; register into `toolRegistry`

## Phase 2: Zustand Stores

- [x] 2.1 Create `apps/web/src/stores/right-panel-store.ts` — tab state (`"properties" | "chat"`), default `"properties"`, actions `setActiveTab`/`activeTab`
- [x] 2.2 Create `apps/web/src/stores/chat-store.ts` — `messages`, `loading`, `error` state; actions `addMessage`, `sendMessage`, `setLoading`, `setError`, `clearMessages`
- [x] 2.3 Create `apps/web/src/stores/agent-store.ts` — `status: ExecutionState`, `activeTool`, `context`; actions `setStatus`, `setActiveTool`, `setContext`, `reset`

## Phase 3: Agent Core — Orchestrator & API

- [x] 3.1 Create `apps/web/src/agent/context.ts` — `EditorContextAdapter.getContext()` reads `EditorCore.media` + `EditorCore.project`, returns plain `AgentContext`. `buildSystemPrompt(context)` template
- [x] 3.2 Create `apps/web/src/app/api/agent/chat/route.ts` — `POST` handler, validates `{ messages }` with zod, returns canned mock response with `toolCalls`
- [x] 3.3 Create `apps/web/src/agent/orchestrator.ts` — `run(messages, context)` sets status → POST API → resolve tool calls via registry → append response to chatStore → idle. Error path sets error + status. Single-pass only

## Phase 4: Chat UI & Editor Wiring

- [x] 4.1 Create `apps/web/src/components/editor/panels/chat/message-bubble.tsx` — renders single `ChatMessage` with role label and content
- [x] 4.2 Create `apps/web/src/components/editor/panels/chat/chat-input.tsx` — text input + send button, disabled while loading, Enter submits
- [x] 4.3 Create `apps/web/src/components/editor/panels/chat/index.tsx` — ChatPanel: scrollable MessageList, empty state placeholder, loading indicator, error banner with retry
- [x] 4.4 Modify `apps/web/src/app/editor/[project_id]/page.tsx` — replace `<PropertiesPanel />` with tabbed wrapper switching between Properties and Chat via `rightPanelStore`

## Phase 5: Tests

- [x] 5.1 Test `echo_context` tool — `__tests__/mock-tool.test.ts` — call execute with known args + context, assert result shape
- [x] 5.2 Test `buildSystemPrompt` — `__tests__/system-prompt.test.ts` — assert media included when present, valid when null
- [x] 5.3 Test `chatStore` actions — `__tests__/chat-store.test.ts` — addMessage, error lifecycle, loading state transitions

## Phase 6: Post-Verify Fix Batch

- [x] 6.1 Fix `orchestrator.ts` — import `mock.tool` for side-effect registration so `echo_context` resolves at runtime; set `agentStore.context` at run start; set `chatStore.loading=false` on success
- [x] 6.2 Fix `ChatPanel` (`chat/index.tsx`) — wire `handleSend` to call `sendMessage` + `orchestrator.run()` via `EditorContextAdapter.getContext()`; add `handleRetry` that re-runs orchestrator after clearing error
- [x] 6.3 Fix error banner — add Retry button alongside Dismiss per spec requirement
- [x] 6.4 Test `agentStore` — `__tests__/agent-store.test.ts` — 7 tests: initial state, status transitions, activeTool tracking, setContext, JSON-serializability, reset
- [x] 6.5 Test `orchestrator` — `__tests__/orchestrator.test.ts` — 5 tests: happy path (no tools), tool call resolution (echo_context), API error, network error, context stored
- [x] 6.6 Test API route — `route.test.ts` — 5 tests: valid input returns mock, missing messages 400, bad role 400, optional context accepted, non-array messages 400

## Phase 7: Post-Verify Gap Closure — Behavioral Evidence

- [x] 7.1 Test `rightPanelStore` — `stores/__tests__/right-panel-store.test.ts` — 5 tests: default tab, switch to chat, switch back, state persistence, valid values
- [x] 7.2 Test types contracts — `agent/__tests__/types-contract.test.ts` — 10 tests: all 6 types importable, shape validation, JSON-serializability
- [x] 7.3 Extract context mapper to `agent/context-mapper.ts` (WASM-free pure function) + test — `agent/__tests__/context-mapper.test.ts` — 6 tests: media populated, no project, undefined duration, tick calculation, JSON-safe, empty assets
- [x] 7.4 Test import boundary — `agent/__tests__/import-boundary.test.ts` — 3 tests: only context.ts imports @/core, context.ts does import @/core, orchestrator doesn't import @/core
- [x] 7.5 Test ChatPanel behavioral scenarios — `stores/__tests__/chat-panel-behavior.test.ts` — 11 tests: tab placement (default + switch), message display (order + empty + fields), input/submission (send + disabled), loading/error states (indicator + retry lifecycle + error persistence), full send→respond cycle
- [x] 7.6 Align spec tool name — updated `agent-session-shell/spec.md` `mock_echo` → `echo_context` to match implementation
