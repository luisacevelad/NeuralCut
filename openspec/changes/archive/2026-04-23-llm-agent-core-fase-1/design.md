# Design: Provider-Agnostic LLM Agent Core — Phase 1

## Technical Approach

Introduce a thin provider-adapter seam at the server boundary so the route never depends on a specific LLM SDK directly. Phase 1 ships one `openai-compatible` adapter (covers OpenAI, Groq, local Ollama, any `baseUrl`-driven provider). The adapter owns message-format conversion, tool-schema conversion, and the API call. The route validates input, builds the system prompt, and delegates to the adapter. The client-side orchestrator gains a multi-turn loop with iteration cap and arg validation. `echo_context` stays out of the provider-facing tool list. `@asset` explicitly deferred.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|----------|--------|----------|-----------|
| Provider integration | `ProviderAdapter` interface + factory; route calls adapter | `openai` SDK directly in route | Proposal requires provider-agnostic core; direct SDK couples route to one vendor |
| Config naming | `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` | `OPENAI_*` vars | Generic names allow adapter swap without env rename; backward compat aliases unnecessary |
| Adapter boundary | Adapter owns message + tool schema conversion + API call | Route does conversion, adapter only calls | Keeps conversion logic co-located with the wire format it serves |
| Tool schema location | Adapter converts `ToolDefinition[]` internally; `toOpenAIFunctions()` moves into adapter | Keep in registry | Registry should not know about any provider's wire format |
| Tool execution | Client-side (orchestrator) | Server-side | Tools need EditorCore/WASM/File — browser-only |
| Iteration cap | Hardcoded `MAX_ITERATIONS = 8` | Configurable | User-specified; 8 provides sufficient reasoning depth |
| `echo_context` | Registered but excluded from provider tool defs | Remove entirely | Still useful for client-side debugging; just not LLM-visible |
| `@asset` deferral | Out of scope | Include | Requires context parser + autocomplete UI + asset resolution — prerequisites absent |

## Data Flow

```
Client (orchestrator.ts)           Server (route.ts)              Adapter
─────────────────────             ─────────────────              ─────────
1. POST {messages, context} ───→  2. Validate (zod)
                                   3. buildSystemPrompt(ctx, tools)
                                   4. createProvider(config)
                                   5. provider.chat()  ────────→  6. Convert msgs → wire fmt
                                                                7. Convert ToolDef[] → wire fmt
                                                                8. Call API          ──→ Provider
                                                                9. Convert resp ←────── back
                            ←──── 10. Return {content, toolCalls}
11. toolCalls?
    ├─ YES: validate args, resolve via registry, append results → go to 1 (loop)
    └─ NO:  append assistant message → done
MAX_ITERATIONS exceeded → limit message, idle
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/agent/providers/types.ts` | **Create** | `ProviderAdapter` interface, `ProviderConfig`, canonical response types |
| `apps/web/src/agent/providers/openai-compatible.ts` | **Create** | OpenAI-compatible adapter implementing `ProviderAdapter` |
| `apps/web/src/agent/providers/index.ts` | **Create** | `createProvider(config)` factory |
| `apps/web/src/app/api/agent/chat/route.ts` | **Modify** | Replace direct `openai` import with `createProvider(config)`; thin validate → build prompt → delegate |
| `apps/web/src/agent/orchestrator.ts` | **Modify** | Multi-turn `while` loop with arg validation + iteration cap |
| `apps/web/src/agent/tools/registry.ts` | **Modify** | Remove `OpenAIFunctionTool` type and `toOpenAIFunctions()` (moved to adapter) |
| `apps/web/.env.local` | **Modify** | Rename `OPENAI_*` → `LLM_*` vars; add `LLM_PROVIDER` |
| `apps/web/.env.example` | **Modify** | Same rename |

## Interfaces / Contracts

### ProviderAdapter

```ts
// providers/types.ts
interface ProviderConfig {
  provider: string;   // "openai-compatible" (Phase 1 only value)
  apiKey: string;
  model: string;
  baseUrl?: string;
}

interface ProviderResponse {
  content: string;
  toolCalls?: ToolCall[];
}

interface ProviderAdapter {
  chat(params: {
    messages: ChatMessage[];
    systemPrompt: string;
    tools: ToolDefinition[];
  }): Promise<ProviderResponse>;
}
```

### Factory

```ts
// providers/index.ts
export function createProvider(config: ProviderConfig): ProviderAdapter {
  switch (config.provider) {
    case "openai-compatible":
      return new OpenAICompatibleAdapter(config);
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}
```

### Environment Variables

```env
LLM_PROVIDER=openai-compatible   # Required
LLM_API_KEY=sk-...               # Required
LLM_MODEL=gpt-4o-mini            # Required
LLM_BASE_URL=                    # Optional — for compatible providers
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `OpenAICompatibleAdapter.chat()` with mocked `openai` SDK | Verify message/tool conversion + response mapping |
| Unit | `createProvider()` factory | Valid config returns adapter; unknown provider throws |
| Unit | Route with mocked `createProvider` | Test 200/400/502 paths |
| Unit | Orchestrator multi-turn loop | Iteration cap, arg validation, tool re-submission, 0/1/2 tool rounds |
| Unit | System prompt tool guidance | Assert tool names appear in output |

## Migration / Rollout

No data migration. Env vars rename from `OPENAI_*` to `LLM_*` is the only config change. Existing `toOpenAIFunctions()` callers in tests must import from the adapter instead of registry. Rollback: revert route to direct `openai` call, restore `OPENAI_*` vars.

## Open Questions

- None — `echo_context` decision settled: registered but excluded from provider-facing defs via the explicit `providerToolDefs` array passed to the adapter.
