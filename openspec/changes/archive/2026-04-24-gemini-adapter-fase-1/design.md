# Design: Gemini Adapter — Phase 1

## Technical Approach

Implement a stateless `GeminiAdapter` class behind the existing `ProviderAdapter` seam, following the exact same pattern as `OpenAICompatibleAdapter`. The adapter converts internal `ChatMessage[]`/`ToolSchema[]` into Gemini's `generateContent()` wire format and parses responses back into `ProviderResponse`. A new `"gemini"` case in `createProvider()` activates it when `LLM_PROVIDER=gemini`. Zero changes to orchestrator, route, or client contracts.

## Architecture Decisions

### Decision: SDK choice

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `@google/generative-ai` | Established, stable, v0.21+, `GoogleGenerativeAI` class, `generateContent()` stateless API | ✅ Selected |
| `@google/genai` | Newer unified SDK, less battle-tested, API may still shift | ❌ Rejected |

**Rationale**: `@google/generative-ai` is the most widely adopted Gemini SDK for Node/TS. It supports `systemInstruction`, `functionDeclaration`, and stateless `generateContent()` — exactly what we need. Consistent with using the mature `openai` SDK for the existing adapter.

### Decision: Stateless generateContent vs stateful startChat

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `model.generateContent(contents, config)` | Stateless, full history each call — matches current adapter contract | ✅ Selected |
| `chat.sendMessage()` via `startChat()` | Stateful session, server-managed history | ❌ Rejected |

**Rationale**: Current architecture POSTs full history from client on every turn. Stateless `generateContent()` maps 1:1 to this pattern. No session management needed.

### Decision: Tool call ID synthesis

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `crypto.randomUUID()` | Built-in, zero deps, unique | ✅ Selected |
| `nanoid()` (already a dep) | Shorter IDs, also unique | ❌ Rejected |

**Rationale**: `crypto.randomUUID()` is universally available in Node/Bun, no import needed, and produces standard UUIDs matching OpenAI's `call_xxx` format semantically. Keeps the adapter self-contained.

### Decision: System prompt placement

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `systemInstruction` on `GenerateContentRequest` | Gemini-native, separate from contents | ✅ Selected |
| Prepend as `user` message | Works but dilutes system/user boundary | ❌ Rejected |

**Rationale**: Gemini SDK supports `systemInstruction` as a first-class config field. Using it keeps system prompt semantically correct and matches Gemini best practices.

## Data Flow

```
Route (chat/route.ts)
  │
  ├─ createProvider(config)  →  GeminiAdapter instance
  │
  └─ adapter.chat({ messages, systemPrompt, tools })
       │
       ├─ toGeminiContents(messages)     →  Content[] (user/model/function)
       ├─ toGeminiTools(tools)           →  FunctionDeclaration[]
       │
       └─ model.generateContent({ contents, tools, systemInstruction })
            │
            └─ fromGeminiResponse(response)  →  ProviderResponse
                  │
                  ├─ content: candidate.content.parts[].text
                  └─ toolCalls: candidate.content.parts[]
                       .filter(functionCall)
                       .map → { id: uuid(), name, args }
```

### Message mapping

| Internal role | Gemini role | Notes |
|---------------|-------------|-------|
| `system` | `systemInstruction` (config) | Not in contents array |
| `user` | `user` part | Direct text mapping |
| `assistant` | `model` part | Includes `functionCall` parts for tool calls |
| `tool_result` | `function` role | Uses `functionResponse: { name, response }` keyed by tool name (not ID) |

### Type mapping (internal → Gemini)

| Internal type | Gemini type |
|---------------|-------------|
| `"string"` | `SchemaType.STRING` |
| `"number"` | `SchemaType.NUMBER` |
| `"boolean"` | `SchemaType.BOOLEAN` |
| `"object"` | `SchemaType.OBJECT` |

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/agent/providers/gemini.ts` | Create | GeminiAdapter + conversion helpers (`toGeminiContents`, `toGeminiTools`, `fromGeminiResponse`) |
| `apps/web/src/agent/providers/index.ts` | Modify | Add `"gemini"` case to factory switch |
| `apps/web/src/agent/providers/__tests__/gemini.test.ts` | Create | Conversion tests, error paths, tool call ID synthesis |
| `apps/web/src/agent/providers/__tests__/index.test.ts` | Modify | Add factory test for `"gemini"` → `GeminiAdapter` |
| `apps/web/package.json` | Modify | Add `@google/generative-ai` dependency |
| `apps/web/.env.example` | Modify | Add Gemini example config lines |

## Interfaces / Contracts

No interface changes. The adapter implements the existing `ProviderAdapter`:

```ts
// Reused as-is from providers/types.ts
interface ProviderAdapter {
  chat(params: {
    messages: ChatMessage[];
    systemPrompt: string;
    tools: ToolSchema[];
  }): Promise<ProviderResponse>;
}
```

### Internal helper signatures (gemini.ts)

```ts
function toGeminiContents(
  messages: ChatMessage[],
): GenerateContentRequest["contents"];

function toGeminiTools(
  tools: ToolSchema[],
): FunctionDeclaration[];

function fromGeminiResponse(
  response: GenerateContentResult,
): ProviderResponse;
```

### Tool call ID — name collision handling

When mapping `tool_result` back to Gemini's `functionResponse`, Gemini keys by function **name** not ID. If multiple calls to the same tool exist in history, we group them by name and send the last result per name. This is acceptable because:

1. Current tool set (`transcribe_video`) is single-invocation per turn
2. Multi-call same-tool scenarios are deferred to a later change
3. Orchestrator already handles the ID→name correlation client-side

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `toGeminiContents` mapping (user, assistant, tool_result, assistant+toolCalls) | Mock SDK, inspect call args |
| Unit | `toGeminiTools` type casing (string→STRING, etc.) | Direct assertion on output |
| Unit | `fromGeminiResponse` content extraction | Construct Gemini response shape, assert `ProviderResponse` |
| Unit | Tool call ID synthesis (non-empty, unique) | Multiple calls produce different IDs |
| Unit | Error: empty candidates → throws | Assert error message |
| Unit | Error: SDK throws → propagates | Assert error bubbles up |
| Unit | Factory: `"gemini"` → `GeminiAdapter` | Instance check |
| Integration | Full `chat()` round-trip with mocked SDK | End-to-end within adapter |

## Migration / Rollout

No migration required. Additive change — setting `LLM_PROVIDER=gemini` activates the new adapter. Existing `openai-compatible` default is untouched.

## Open Questions

- [ ] Confirm `@google/generative-ai` latest stable version at impl time (currently ^0.21)
- [ ] Verify Gemini model naming convention user will use (e.g. `gemini-2.0-flash` vs `models/gemini-2.0-flash`)
