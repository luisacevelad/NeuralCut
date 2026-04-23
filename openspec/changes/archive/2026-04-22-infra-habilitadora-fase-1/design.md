# Design: Infra Habilitadora — Fase 1

## Technical Approach

Thin vertical slice: chat UI in the existing right panel (tabbed with Properties), a Zustand store for messages/execution state, a client-side orchestrator shell that resolves tool calls locally via `DefinitionRegistry`, and a stateless API route as LLM proxy. One mock tool validates the full pipeline. No business logic enters `apps/web/src/agent/` — only I/O contracts and orchestration wiring.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|----------|--------|----------|-----------|
| Chat panel placement | Tab switcher wrapping right `ResizablePanel` content (Properties \| Chat) | Separate 5th panel, floating panel | Zero layout changes. Panel sizes untouched. Tab state in a small Zustand store (`rightPanelStore`). |
| Tool execution location | Client-side (orchestrator runs in browser) | Server-side tool execution | Tools that modify timeline need `EditorCore`. API route is only an LLM proxy boundary — keeps it stateless. |
| Context coupling | Thin adapter (`agent/context.ts`) reads EditorCore and returns a plain POJO | Direct EditorCore import in tools | Single file touches EditorCore. Tools receive `AgentContext` interface — future Rust migration swaps the adapter, not the tools. |
| Store split | Two stores: `chatStore` (messages, UI state) + `agentStore` (execution state, context) | Single store | Separation of concerns: chat UI owns display; agent owns execution lifecycle. chatStore doesn't know about tools. |
| API route role | Stateless passthrough (request → mock response) | Business logic in route | Route never owns state. In v1 returns hardcoded mock; in production forwards to LLM provider. |
| Tool registry | Reuse `DefinitionRegistry<string, ToolDefinition>` from `lib/registry.ts` | Custom registry | Already generic and battle-tested. `ToolDefinition` is `{ name, description, parameters, execute }`. |

## Data Flow

```
User types message
        │
        ▼
  ChatPanel (React)
  calls chatStore.sendMessage(text)
        │
        ▼
  chatStore ──────────────────────────────┐
  - adds UserMessage                       │
  - sets status: 'sending'                 │
  - calls agentStore.runTurn(messages)     │
        │                                  │
        ▼                                  │
  agentStore.runTurn()                     │
  1. gather context via context adapter    │
  2. POST /api/agent/chat                  │
     { messages, context }                 │
        │                                  │
        ▼                                  │
  API Route (stateless proxy)              │
  → returns mock LLM response              │
  with tool_call: { name, args }           │
        │                                  │
        ▼                                  │
  agentStore resolves tool_call            │
  - lookups in DefinitionRegistry          │
  - execute(tool, args, context)           │
  - appends ToolResult to messages         │
  - POST again (final answer)              │
        │                                  │
        ▼                                  │
  chatStore ◄──────────────────────────────┘
  - adds AssistantMessage
  - sets status: 'idle'
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/stores/right-panel-store.ts` | Create | Tab state for right panel (Properties \| Chat) |
| `apps/web/src/stores/chat-store.ts` | Create | Messages, loading, error state |
| `apps/web/src/stores/agent-store.ts` | Create | Execution lifecycle + context snapshot |
| `apps/web/src/agent/types.ts` | Create | Shared contracts: `ChatMessage`, `ToolCall`, `ToolResult`, `AgentContext`, `ExecutionState` |
| `apps/web/src/agent/context.ts` | Create | Adapter: reads EditorCore → returns `AgentContext` POJO |
| `apps/web/src/agent/orchestrator.ts` | Create | Client-side turn loop: send → receive → resolve tools → respond |
| `apps/web/src/agent/tools/registry.ts` | Create | `toolRegistry` instance + mock tool registration |
| `apps/web/src/agent/tools/mock.tool.ts` | Create | Single mock tool (`echo_context`) returning context summary |
| `apps/web/src/app/api/agent/chat/route.ts` | Create | Stateless proxy — returns mock response with tool call |
| `apps/web/src/components/editor/panels/chat/index.tsx` | Create | ChatPanel UI: message list + input |
| `apps/web/src/components/editor/panels/chat/message-bubble.tsx` | Create | Single message rendering |
| `apps/web/src/components/editor/panels/chat/chat-input.tsx` | Create | Text input + send button |
| `apps/web/src/app/editor/[project_id]/page.tsx` | Modify | Replace `<PropertiesPanel />` with `<RightPanel />` wrapper |

## Interfaces / Contracts

```typescript
// agent/types.ts

export type ExecutionState = 'idle' | 'sending' | 'processing' | 'responding' | 'error';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool_result';
  content: string;
  toolCalls?: ToolCall[];
  timestamp: number;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: unknown;
  error?: string;
}

export interface AgentContext {
  projectId: string | null;
  activeSceneId: string | null;
  mediaAssets: Array<{ id: string; name: string; type: string; duration: number }>;
  playbackTimeMs: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Array<{ key: string; type: string; required: boolean }>;
  execute: (args: Record<string, unknown>, context: AgentContext) => Promise<unknown>;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `ToolDefinition.execute` | Call with known args + context, assert result |
| Unit | Context adapter | Mock EditorCore managers, verify POJO output |
| Unit | Orchestrator turn resolution | Feed mock LLM response with tool_call, verify tool executes |
| Integration | `chatStore` + `agentStore` flow | Zustand store test: dispatch send, mock API, assert final state |
| E2E | Chat panel renders + sends | Skipped for v1 (no test infra for React components yet) |

## Migration / Rollout

No migration required. New code is additive — the right panel wrapper defaults to "Properties" tab, so existing behavior is preserved. Rollback per proposal: remove wrapper, delete `agent/`, stores, and API route.

## Open Questions

- [ ] Should the orchestrator support multi-turn tool loops (tool calls that spawn more tool calls) or single-pass only in v1? Recommendation: single-pass for simplicity.
- [ ] Streaming support in API response shape — design types to allow `ReadableStream` in the future, but v1 returns a plain JSON object.
