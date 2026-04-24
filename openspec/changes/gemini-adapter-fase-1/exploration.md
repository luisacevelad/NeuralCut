# Exploration: Gemini Adapter — Phase 1

## Current State

Phase 1 (`llm-agent-core-fase-1`) shipped a **provider-agnostic adapter seam** with one concrete implementation (`OpenAICompatibleAdapter`). The architecture is:

```
Client (orchestrator.ts) → POST /api/agent/chat → route.ts → createProvider(config) → ProviderAdapter.chat()
```

### Key contracts already in place

| Artifact | Location | Role |
|----------|----------|------|
| `ProviderAdapter` interface | `apps/web/src/agent/providers/types.ts` | Single `chat()` method, provider-agnostic |
| `ProviderConfig` | Same file | `{ provider, apiKey, model, baseUrl? }` |
| `ProviderResponse` | Same file | `{ content, toolCalls? }` |
| `ToolSchema` (internal) | `apps/web/src/agent/types.ts` | `{ name, description, parameters: Array<{ key, type, required }> }` |
| `ToolCall` (internal) | Same file | `{ id, name, args }` |
| `createProvider()` factory | `apps/web/src/agent/providers/index.ts` | Switch on `config.provider`, returns adapter |
| `OpenAICompatibleAdapter` | `apps/web/src/agent/providers/openai-compatible.ts` | Reference implementation |
| Route handler | `apps/web/src/app/api/agent/chat/route.ts` | Reads `LLM_*` env vars, calls `createProvider()` |
| Orchestrator (client) | `apps/web/src/agent/orchestrator.ts` | Multi-turn loop, MAX_ITERATIONS=8 |

The orchestrator runs **client-side** and drives a multi-turn loop: it POSTs the full message history each turn, the route delegates to the adapter, and the orchestrator resolves tool calls via the registry before looping. The adapter is **stateless** — it receives the full conversation every call.

### Test patterns

- Tests use `bun:test` with `jest.mock()` for SDK mocking.
- Factory tests: verify correct adapter returned per provider string, unknown throws.
- Adapter tests: mock SDK `create()`, assert wire-format conversion of messages/tools, response parsing.
- Route tests: mock `createProvider`, assert 400/502/status paths.

## Affected Areas

| File | Why |
|------|-----|
| `apps/web/src/agent/providers/gemini.ts` | **NEW** — Gemini adapter implementation |
| `apps/web/src/agent/providers/index.ts` | Add `"gemini"` case to factory switch |
| `apps/web/src/agent/providers/types.ts` | May need minor extension if `baseUrl` semantics differ |
| `apps/web/.env.example` | Document `LLM_PROVIDER=gemini` option |
| `apps/web/package.json` | Add `@google/generative-ai` dependency |
| `apps/web/src/agent/providers/__tests__/gemini.test.ts` | **NEW** — adapter unit tests |
| `apps/web/src/agent/providers/__tests__/index.test.ts` | Add factory test for `"gemini"` |

**Unchanged** (confirmed safe):
- `route.ts` — already provider-agnostic via factory
- `orchestrator.ts` — client-side, never touches provider details
- `types.ts` (agent types) — `ToolSchema`, `ToolCall`, `ChatMessage` are provider-agnostic
- `tools/registry.ts` — provider-agnostic schema export
- `system-prompt.ts` — pure function, no provider coupling

## Gemini API — Function Calling Wire Format

### Differences from OpenAI

| Concern | OpenAI | Gemini |
|---------|--------|--------|
| SDK | `openai` npm package | `@google/generative-ai` npm package |
| Client init | `new OpenAI({ apiKey, baseURL? })` | `new GoogleGenerativeAI(apiKey)` then `getGenerativeModel({ model, tools })` |
| Tool declaration | `{ type: "function", function: { name, description, parameters } }` | `{ functionDeclarations: [{ name, description, parameters }] }` |
| Parameter types | lowercase JSON Schema: `object`, `string`, `number` | UPPERCASE: `OBJECT`, `STRING`, `NUMBER`, `BOOLEAN`, `ARRAY` |
| Required params | `required: ["key"]` array in schema | `required: ["key"]` array — same shape |
| Response — function call | `choice.message.tool_calls[].function` | `response.functionCalls()` array |
| Function call ID | Has `id` field | **No `id` field** — uses `name` for matching |
| Multi-turn history | Stateless: full message array each call | Stateful: `startChat()` accumulates, OR stateless via `generateContent` with full history |
| Tool result | `{ role: "tool", tool_call_id, content }` | `{ functionResponse: { name, response } }` |
| System prompt | `{ role: "system", content }` message | `systemInstruction` on model config, OR `user` message with system text |

### Critical mapping: Gemini → Internal types

```
Gemini FunctionCall { name, args } → Internal ToolCall { id: <generated>, name, args }
Gemini FunctionDeclaration → Internal ToolSchema conversion needed (type casing)
Gemini functionResponse → mapped to internal tool_result role
```

**Key gotcha**: Gemini function calls have **no ID**. The internal `ToolCall` requires `id`. The adapter must synthesize IDs (e.g., `tc_${nanoid()}` or `gemini_${index}`).

### Multi-turn approach

The current adapter contract is **stateless** — `chat()` receives full messages every call. Gemini's `startChat()` is stateful. Two options:

1. **Stateless via `generateContent()`**: Pass full conversation history as `contents` array each call. This matches the current contract perfectly.
2. **Stateful via `startChat()`**: Would require adapter to maintain session state — breaks the contract.

**Recommendation**: Use `generateContent()` with full `contents` array — stateless, matches contract, simpler.

## Approaches

### 1. Native Gemini SDK Adapter (Recommended)

Create `GeminiAdapter` class implementing `ProviderAdapter` using `@google/generative-ai` SDK.

**Pros**:
- Type-safe SDK — handles auth, retries, streaming-ready for future
- Google's SDK manages edge cases (safety settings, grounding)
- Matches pattern of `OpenAICompatibleAdapter` using the `openai` SDK
- Future-proof for video/multimodal when that phase arrives

**Cons**:
- New dependency (`@google/generative-ai`, ~50KB)
- SDK-specific quirks to learn (e.g., `generateContent` vs `startChat`)

**Effort**: Medium — adapter + conversion logic + tests ≈ 150-200 lines

### 2. Raw `fetch` to Gemini REST API

Implement adapter using native `fetch` against `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`.

**Pros**:
- Zero dependencies
- Full control over request shape
- Educational — understand every byte

**Cons**:
- Manual auth header management
- No type safety for response shapes
- Must handle all edge cases manually (safety ratings, grounding, etc.)
- Deviates from established pattern (OpenAI adapter uses SDK)

**Effort**: Medium-High — more boilerplate, more edge cases

### 3. OpenAI-Compatible Proxy (Gemini via OpenAI format)

Use an existing OpenAI-compatible proxy/endpoint that translates Gemini to OpenAI format, then reuse `OpenAICompatibleAdapter` with a custom `baseUrl`.

**Pros**:
- Zero code changes — just config
- Immediate

**Cons**:
- **External dependency on a proxy service** — unreliable, adds latency
- Gemini-specific features (multimodal, large context) may not translate
- Defeats the purpose of having a native adapter
- User would need to set up/maintain the proxy

**Effort**: Low — but architecturally wrong

## Recommendation

**Approach 1: Native Gemini SDK Adapter.**

Rationale:
1. Matches the established pattern (SDK-backed adapter, see `OpenAICompatibleAdapter`).
2. Clean adapter boundary — the `ProviderAdapter` contract needs **zero changes**.
3. Only the factory switch + new file needed — route, orchestrator, types all untouched.
4. Sets up cleanly for future multimodal/video upload phases.

## Minimum Scope (Phase 1)

### In scope
- `GeminiAdapter` class with `chat()` implementing `ProviderAdapter`
- Message conversion: internal `ChatMessage[]` → Gemini `contents[]` + `systemInstruction`
- Tool schema conversion: internal `ToolSchema[]` → Gemini `FunctionDeclaration[]`
- Response parsing: Gemini `functionCalls` → internal `ToolCall[]` (with synthesized IDs)
- Tool result conversion: internal `tool_result` messages → Gemini `functionResponse` parts
- Factory registration: `"gemini"` case in `createProvider()`
- Config: `LLM_PROVIDER=gemini`, `LLM_API_KEY`, `LLM_MODEL=gemini-2.5-flash`
- Tests: factory, adapter (message conversion, tool conversion, response parsing, error handling)
- `.env.example` update

### Explicitly deferred
- Video/file upload API (multimodal input) — requires `FileAPI` integration
- `@asset` references in prompts — needs multimodal pipeline
- Streaming responses — requires `ProviderAdapter` contract change (streaming interface)
- Image understanding — requires multimodal content parts
- Safety settings / content filtering customization
- Grounding with Google Search
- Thinking/reasoning config

## Risks

1. **No native tool call IDs in Gemini** — adapter must synthesize them. If the orchestrator or client uses tool call IDs for matching, synthesized IDs must be deterministic or the orchestrator must handle mismatches gracefully. Current orchestrator matches by sequential position via `toolCallId` — this should work as long as the adapter generates unique IDs per call.

2. **Parameter type mapping** — internal `ToolSchema` uses lowercase types (`"string"`, `"number"`, `"boolean"`). Gemini expects UPPERCASE. The adapter must transform these. If a new type is added to `ToolSchema` later (e.g., `"array"`, `"object"`), the adapter must handle it.

3. **`baseUrl` unused for Gemini** — Google's endpoint is fixed. If someone sets `LLM_BASE_URL` with `LLM_PROVIDER=gemini`, the adapter should either ignore it or use it as an override for Vertex AI endpoints. Need a decision.

4. **System prompt placement** — Gemini supports `systemInstruction` on model config OR as a user message. Using `systemInstruction` is cleaner but means the system prompt goes to the model constructor, not in the `contents` array. The adapter must handle this correctly.

5. **Rate limits / pricing** — Gemini Flash is generous but not unlimited. Not a code risk, but worth documenting for users.

6. **SDK version compatibility** — `@google/generative-ai` is marked as "deprecated" in the Context7 listing (the library ID is `/google-gemini/deprecated-generative-ai-js`). Need to verify the current recommended package. Google has been migrating to `@google/genai` as the newer SDK. Must check which one to use before implementation.

## Ready for Proposal

**Yes.** The scope is clear, the contract is well-defined, and the risks are identified. The next step is to run `sdd-propose` to formalize the change proposal.

Key inputs for the proposal:
- Scope: single new adapter + factory registration + tests + env docs
- No changes to existing contracts (`ProviderAdapter`, `ToolSchema`, `ToolCall`)
- Verification: unit tests passing, `bun test` green, `LLM_PROVIDER=gemini` resolves correctly
