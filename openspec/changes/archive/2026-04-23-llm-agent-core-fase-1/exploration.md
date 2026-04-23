# Exploration: LLM Agent Core — Phase 1

## Current State

### Agent Infrastructure (shipped in `infra-habilitadora-fase-1` + `transcribe-video-fase-1`)

The agent pipeline is wired end-to-end but driven entirely by a **mock API route** that does keyword matching:

```
ChatPanel → handleSend → orchestrator.run(messages, context) → POST /api/agent/chat → mock route
  ↓
orchestrator receives { content, toolCalls[] } → resolves toolCalls via toolRegistry → appends to chatStore
```

**Key files and their current roles:**

| File | Current role |
|------|-------------|
| `agent/types.ts` | `ChatMessage`, `ToolCall`, `ToolResult`, `AgentContext`, `ToolDefinition` — all typed |
| `agent/orchestrator.ts` | Client-side single-pass: POST to API route → resolve tool calls → append messages |
| `agent/tools/registry.ts` | `DefinitionRegistry<string, ToolDefinition>` — `register()`, `get()`, `getAll()` |
| `agent/tools/mock.tool.ts` | `echo_context` — returns context summary, for debugging |
| `agent/tools/transcribe-video.tool.ts` | `transcribe_video` — full Whisper pipeline via EditorContextAdapter |
| `agent/system-prompt.ts` | Static builder: editor name, project, scene, assets, playback position |
| `agent/context.ts` | EditorContextAdapter — only file that touches EditorCore |
| `agent/context-mapper.ts` | Pure data mapping (WASM-free testability) |
| `app/api/agent/chat/route.ts` | **MOCK** — keyword match ("transcri") → hardcoded tool calls |
| `stores/chat-store.ts` | Zustand: messages, loading, error, addMessage, sendMessage |
| `stores/agent-store.ts` | Zustand: status, activeTool, context |
| `components/.../chat/index.tsx` | ChatPanel UI — sends via orchestratorRun |

### What Must Change

The mock `route.ts` is the **entire bottleneck**. It:
1. Returns hardcoded responses based on keyword matching
2. Has NO understanding of conversation history
3. Has NO real LLM integration
4. Always returns a `toolCalls` array (never free-form chat)

Everything else (types, orchestrator, registry, context adapter, stores, UI) is well-structured and **reusable with minimal changes**.

## Affected Areas

- `apps/web/src/app/api/agent/chat/route.ts` — **must be rewritten** to call a real LLM provider
- `apps/web/src/agent/types.ts` — `ToolDefinition.parameters` uses a flat `{ key, type, required }[]` format; needs to map to provider-native JSON Schema for tool calling
- `apps/web/src/agent/orchestrator.ts` — currently single-pass; needs loop support for multi-turn tool calling (LLM may call tools, get results, then call more tools)
- `apps/web/src/agent/system-prompt.ts` — needs to be sent to the provider as a system message (already built, just needs to be consumed server-side)
- `apps/web/src/agent/tools/registry.ts` — `getAll()` exists and returns all `ToolDefinition`s; needs a method to export them as provider-native tool schemas
- `apps/web/src/agent/tools/mock.tool.ts` — `echo_context` becomes unnecessary once the LLM can answer context questions naturally; remove or keep for debugging
- `apps/web/.env.local` — needs `LLM_API_KEY` and potentially `LLM_BASE_URL`
- `apps/web/package.json` — needs the SDK dependency for the chosen provider

## Approaches

### 1. OpenAI SDK Direct (single provider, OpenAI-compatible)

Use the official `openai` npm package. Works with OpenAI, and any OpenAI-compatible API (Ollama, Together, Groq, etc.) by changing `baseURL`.

- **Pros**: Industry-standard SDK, native tool calling support (`tools` param with JSON Schema), streaming support, battle-tested, one dependency
- **Cons**: Couples to OpenAI's tool-calling format initially; if you later need a non-OpenAI-compatible provider, you'd need an adapter
- **Effort**: Low — route.ts rewrite + tool schema mapper + env var

### 2. Vercel AI SDK (`ai` package)

Use Vercel's AI SDK which provides a unified interface over multiple providers (OpenAI, Anthropic, Google, etc.) with `generateText()` / `streamText()`.

- **Pros**: Provider-agnostic from day one, streaming built-in, tool calling abstraction, integrates with Next.js route handlers natively
- **Cons**: Extra abstraction layer, another dependency to version-track, may over-abstract what is currently a simple call, learning curve for its conventions
- **Effort**: Low-Medium — new dependency + learn SDK patterns + route rewrite

### 3. Custom thin wrapper over fetch

Build a minimal `LLMProvider` interface and implement one provider with raw `fetch`.

- **Pros**: Zero new dependencies, full control, exactly what you need
- **Cons**: Must implement streaming parsing, retry logic, error handling, tool calling serialization yourself; NIH risk
- **Effort**: Medium — significant boilerplate for production-quality

## Recommendation

**Approach 1: OpenAI SDK Direct** — and here's why:

1. **YAGNI**: The user wants ONE provider working first. Don't build abstraction for multiple providers until you actually need the second one.
2. **Tool calling is native**: OpenAI's `tools` parameter maps directly to JSON Schema, which maps cleanly from the existing `ToolDefinition` type. The SDK handles function calling, parallel tool calls, and the full request/response cycle.
3. **OpenAI-compatible = flexible enough**: By setting `baseURL`, you get Ollama (local), Together, Groq, Mistral — all without code changes. This covers the realistic provider landscape without an abstraction layer.
4. **Route handler is the seam**: The API route (`/api/agent/chat`) is already the boundary between client and "LLM". Changing providers later means changing ONE file. That's the correct abstraction level.

**If the user explicitly needs Anthropic/Claude later**, that's the moment to consider the Vercel AI SDK or a thin adapter — not before.

## Architecture: How the LLM Loop Works

```
Client (orchestrator.ts)                    Server (route.ts)
─────────────────────────                   ─────────────────────
POST { messages[], context }
                                            1. Build system prompt from context
                                            2. Map toolRegistry.getAll() → OpenAI tools[]
                                            3. Call openai.chat.completions.create({
                                                 model, messages, tools
                                               })
                                            4. If response has tool_calls:
                                                 → Return { content, toolCalls } to client
                                            5. If no tool_calls:
                                                 → Return { content } (free-form chat)
                                            
Receives { content, toolCalls? }
  ├─ No tool calls → display content
  └─ Has tool calls → resolveToolCalls() on client
       → Append tool_result messages
       → POST again with updated history (loop)
```

The key insight: **the orchestrator already handles tool resolution on the client** (tools like `transcribe_video` need `EditorContextAdapter` which only exists client-side). The server just decides WHAT tools to call; the client EXECUTES them and feeds results back.

This means we need the orchestrator to **loop**: send → receive → execute tools → send results back → receive final response.

### System Prompt Strategy

The current `buildSystemPrompt()` is a good start but needs enhancement for the LLM to be genuinely useful:

```typescript
// What the system prompt should contain:
1. Identity: "You are an AI assistant embedded in the NeuralCut video editor."
2. Editor context: project, scene, assets (already exists)
3. Available tools: list of tool names + descriptions (from registry)
4. Behavioral guidance: when to use tools vs. answer directly
5. Asset awareness: the model should know asset IDs so it can reference them in tool calls
```

### Tool Schema Mapping

Current `ToolDefinition.parameters`:
```typescript
parameters: Array<{ key: string; type: string; required: boolean }>
```

OpenAI expects JSON Schema in `tools[].function.parameters`:
```json
{
  "type": "object",
  "properties": { "assetId": { "type": "string", "description": "..." } },
  "required": ["assetId"]
}
```

A thin mapper function converts between these formats. This lives server-side in the route handler.

### `transcribe_video` as First Real Tool

Already implemented and working. To expose it to the LLM:
1. The server reads `toolRegistry.getAll()` and maps to OpenAI tool format
2. The LLM sees `transcribe_video` with its description and parameters
3. When the LLM decides to call it, the orchestrator resolves it client-side as it already does
4. **No changes needed to the tool itself** — it already works via the registry

### `@asset` References

**Defer to Phase 2.** Prerequisites:
1. A working LLM chat loop (this phase)
2. The LLM already knowing about assets via system prompt
3. A UI-side parser that detects `@` triggers and offers autocomplete
4. The parser mapping `@asset_name` → `assetId` before sending to the API

This is a UX feature layered on top of the LLM core, not part of the core itself.

## Minimum Viable Scope (Thin Vertical Slice)

**Goal**: "Real LLM chat works + one tool works end-to-end"

### In Scope
1. Add `openai` SDK dependency
2. Add `LLM_API_KEY` + `LLM_BASE_URL` + `LLM_MODEL` env vars
3. Rewrite `route.ts` to call OpenAI chat completions with:
   - System prompt from `buildSystemPrompt(context)`
   - Tool schemas from `toolRegistry.getAll()` mapped to OpenAI format
   - Conversation history from `messages[]`
4. Add tool schema mapper utility (server-side)
5. Update `orchestrator.ts` to support **multi-turn tool calling loop**:
   - Send messages → receive response
   - If tool calls: execute, append results, POST again
   - Repeat until no tool calls (LLM gives final answer)
6. Wire `transcribe_video` tool (already works, just needs to be visible to LLM)
7. Remove or deprecate keyword-based mock logic

### Out of Scope (deferred)
- `@asset` reference syntax (Phase 2)
- Streaming responses (can add later)
- Multiple provider support (YAGNI)
- Conversation persistence (in-memory only for now)
- Tool result rendering in UI (just show JSON for now)
- Token counting / rate limiting

## Risks

1. **LLM may hallucinate tool calls**: The model might call tools with wrong arguments. Mitigation: validate args server-side before returning to client.
2. **Tool execution is client-only**: `transcribe_video` needs `EditorContextAdapter` which requires `EditorCore`. This already works but means tools can't run server-side. This is correct for now (WASM is client-side) but limits future server-side tools.
3. **Orchestrator loop could infinite-loop**: If the LLM keeps requesting tool calls. Mitigation: max iterations constant (e.g., 5).
4. **API key exposure**: Must use server-only env vars (no `NEXT_PUBLIC_`). The route handler is server-side, so this is safe by default.
5. **Latency**: LLM calls add network latency. The current mock is instant. Users will notice. Mitigation: streaming (deferred) or a loading state that's already in place.
6. **Cost**: Every chat message hits the LLM API. No local caching yet. Start with a cheap model (`gpt-4o-mini` or local Ollama).

## Ready for Proposal

**Yes.** The exploration is complete. The scope is clear, the approach is decided (OpenAI SDK direct), and the thin vertical slice is well-defined.

The orchestrator should tell the user:
- We recommend OpenAI SDK as the thinnest viable integration
- The API route is the ONLY file that fundamentally changes
- The orchestrator needs a loop for multi-turn tool calling
- `transcribe_video` needs zero changes — it just becomes visible to the LLM
- `@asset` should be deferred to Phase 2
