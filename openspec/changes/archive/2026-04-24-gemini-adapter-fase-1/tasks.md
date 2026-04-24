# Tasks: Gemini Adapter — Phase 1

## Phase 1: Foundation

- [x] 1.1 Add `@google/generative-ai` dependency to `apps/web/package.json` (pin to latest stable `^0.21` or newer)
- [x] 1.2 Add Gemini env config lines to `apps/web/.env.example`: `LLM_PROVIDER=gemini`, `LLM_API_KEY`, `LLM_MODEL=gemini-2.0-flash`, comment noting `LLM_BASE_URL` is ignored for gemini

## Phase 2: Core Adapter

- [x] 2.1 Create `apps/web/src/agent/providers/gemini.ts` — import `GoogleGenerativeAI` from `@google/generative-ai`, `SchemaType` for type mapping
- [x] 2.2 Implement `toGeminiContents(messages: ChatMessage[])` — map `user→user`, `assistant→model` (with `functionCall` parts), `tool_result→function` role with `functionResponse`; skip `system` role (handled separately)
- [x] 2.3 Implement `toGeminiTools(tools: ToolSchema[])` — convert each `ToolSchema` to a `FunctionDeclaration` with `SchemaType` property types (`string→STRING`, `number→NUMBER`, `boolean→BOOLEAN`, `object→OBJECT`); return empty array when no tools
- [x] 2.4 Implement `fromGeminiResponse(response)` — extract `candidate.content.parts`, pull text into `content`, filter `functionCall` parts into `toolCalls[]` with `id: crypto.randomUUID()`, `name`, `args`; throw on empty candidates
- [x] 2.5 Implement `GeminiAdapter` class — constructor takes `ProviderConfig`, creates `GoogleGenerativeAI` + `getGenerativeModel({ model, systemInstruction })`; `chat()` calls `model.generateContent({ contents, tools })` then returns `fromGeminiResponse()`; ignore `config.baseUrl`

## Phase 3: Factory Integration

- [x] 3.1 Add `"gemini"` case to `createProvider()` switch in `apps/web/src/agent/providers/index.ts` — import and return `new GeminiAdapter(config)`
- [x] 3.2 Verify existing `openai-compatible` factory case is untouched and all existing tests still pass

## Phase 4: Tests

- [x] 4.1 Create `apps/web/src/agent/providers/__tests__/gemini.test.ts` — test `toGeminiContents`: user message, assistant with toolCalls, tool_result mapping, system message excluded from contents
- [x] 4.2 Test `toGeminiTools`: single tool with parameters, type casing (`string→STRING` etc.), empty tools returns empty array
- [x] 4.3 Test `fromGeminiResponse`: text-only response → `{ content, toolCalls: undefined }`; function-call response → `toolCalls` with non-empty synthesized IDs; two calls produce different IDs
- [x] 4.4 Test error paths: empty candidates → throws; SDK error → propagates
- [x] 4.5 Add factory test to `apps/web/src/agent/providers/__tests__/index.test.ts`: `"gemini"` config → `GeminiAdapter` instance; unknown provider still throws
- [x] 4.6 Test full `chat()` round-trip with mocked `GoogleGenerativeAI` — verify `generateContent` called with correct contents, tools, and systemInstruction
