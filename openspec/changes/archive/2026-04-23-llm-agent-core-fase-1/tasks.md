# Tasks: Provider-Agnostic LLM Agent Core — Phase 1

## Phase 1: Provider Adapter Extraction

- [x] 1.1 Create `apps/web/src/agent/providers/types.ts` — `ProviderConfig { provider, apiKey, model, baseUrl? }`, `ProviderResponse { content, toolCalls? }`, `ProviderAdapter.chat()` interface
- [x] 1.2 Create `apps/web/src/agent/providers/openai-compatible.ts` — move `toOpenAIMessages()` from `route.ts` and `toOpenAIFunctions()` from `registry.ts` into adapter; implement `ProviderAdapter.chat()` using `openai` SDK
- [x] 1.3 Create `apps/web/src/agent/providers/index.ts` — `createProvider(config)` factory: switch on `config.provider`, return `OpenAICompatibleAdapter` for `"openai-compatible"`, throw for unknown
- [x] 1.4 Clean `apps/web/src/agent/tools/registry.ts` — remove `OpenAIFunctionTool` type and `toOpenAIFunctions()` export (now adapter-owned)

## Phase 2: Route + Config Migration

- [x] 2.1 Rename `OPENAI_*` → `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL` in `apps/web/.env.local` and `.env.example`
- [x] 2.2 Rewrite `apps/web/src/app/api/agent/chat/route.ts` — remove direct `openai` import; read `LLM_*` env vars; call `createProvider(config)`; delegate to `provider.chat({ messages, systemPrompt, tools })`; keep zod validation and 400/502 error paths

## Phase 3: Client Multi-Turn Orchestrator Loop

- [x] 3.1 Refactor `run()` in `apps/web/src/agent/orchestrator.ts` into `while (iterations < MAX_ITERATIONS=8)`: POST → if `toolCalls`, validate args + resolve via registry + append tool_result to history → loop; if no toolCalls, append final message + break
- [x] 3.2 Add arg validation in orchestrator: check each `required: true` param exists and matches declared type; on failure return `ToolResult` with error (tool does NOT execute)
- [x] 3.3 Max-iteration guard: stop loop, append limit message to chatStore, set idle

## Phase 4: Tests

- [x] 4.1 Unit test `createProvider()` in `apps/web/src/agent/providers/__tests__/index.test.ts` — valid config returns adapter; unknown provider throws
- [x] 4.2 Unit test `OpenAICompatibleAdapter.chat()` in `apps/web/src/agent/providers/__tests__/openai-compatible.test.ts` — mock `openai` SDK; verify message/tool conversion and response mapping
- [x] 4.3 Rewrite `apps/web/src/app/api/agent/chat/__tests__/route.test.ts` — mock `createProvider`; test 200/400/502 paths; remove keyword-matching assertions
- [x] 4.4 Rewrite `apps/web/src/agent/__tests__/orchestrator.test.ts` — no-tool round, one tool round + loop, max-iteration guard, arg validation failure; remove `echo_context` references
- [x] 4.5 Update `apps/web/src/agent/__tests__/system-prompt.test.ts` — verify prompt includes tool guidance section with tool names listed

## Phase 5: Post-Verify Fix Batch

- [x] 5.1 Fix route missing-config status: 500 → 502 to match spec requirement
- [x] 5.2 Add `ToolSchema` type and `toToolSchemas()` to registry — provider-agnostic schema export without `execute`
- [x] 5.3 Fix TypeScript failures: zod v4 `z.record()` arity, missing `id`/`timestamp` in zod schema, OpenAI union type narrowing for tool_calls, jest.mock type augmentation
- [x] 5.4 Fix pre-existing `message-bubble.tsx` TS error (missing `system` role label)

## Phase 7: Spec-Wording Alignment

- [x] 7.1 Align provider-error payload wording with spec: route 502 catch block returns `{ error: "LLM provider error" }` (was `"Failed to get response from AI provider"`). Updated test assertion accordingly.

## Completed (Prior Work)

- [x] P0.1 Add `openai` to `apps/web/package.json` and install
- [x] P0.2 Add `OPENAI_*` env vars to `.env.local` / `.env.example`
- [x] P0.3 Extend `ChatMessage.role` to accept `"system"` + `"tool_result"`, add `toolCallId` field
- [x] P0.4 Extend `buildSystemPrompt()` with tool guidance section
- [x] P0.5 Route rewritten with zod validation + OpenAI SDK + tool schema export
- [x] P0.6 Remove `echo_context` import from orchestrator
