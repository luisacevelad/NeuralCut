# Proposal: Provider-Agnostic LLM Core — Phase 1

## Intent

Replace the mock chat route with a real LLM loop while correcting the architecture: provider choice MUST be config-driven, not hardcoded to OpenAI, so NeuralCut can target local Ollama, OpenAI, Groq, Gemini-class future adapters, and other compatible providers from one core contract.

## Scope

### In Scope
- Define a common internal provider interface plus server-only config for `provider`, `model`, `apiKey`, and `baseUrl`.
- Replace the mock route with a real provider-backed conversational loop and iterative client-side tool execution.
- Keep `transcribe_video` as the first real tool and inject context/tool guidance through the system prompt.

### Out of Scope
- `@asset` references, autocomplete, asset parsing, streaming, persistence, token accounting, and richer tool rendering.
- Multiple native transport adapters in this phase; one initial OpenAI-compatible adapter path is enough if the core contract stays provider-agnostic.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-session-shell`: replace canned route behavior with config-selected provider execution and iterative tool-call orchestration.
- `agent-context-bridge`: strengthen system-prompt requirements so editor context is injected as server-consumed provider guidance.

## Approach

Add a thin provider port at the server boundary, selected by config. Phase 1 may ship a single OpenAI-compatible adapter covering OpenAI, Groq, local Ollama, and similar `baseUrl`-driven providers, while leaving room for a separate Gemini adapter later. Keep tool execution client-side because tools depend on editor/WASM context. The orchestrator loops until the model stops requesting tools or a max-iteration guard is hit.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/web/src/app/api/agent/chat/route.ts` | Modified | Route validates config-backed requests and calls selected provider adapter |
| `apps/web/src/agent/orchestrator.ts` | Modified | Multi-turn tool-call loop with guardrails |
| `apps/web/src/agent/system-prompt.ts` | Modified | Provider-ready context and tool guidance |
| `apps/web/src/agent/tools/registry.ts` | Modified | Provider-agnostic tool schema export |
| `apps/web/src/agent/` | Modified | Internal provider interface/adapter seam |
| `apps/web/.env.local` | Modified | Server-only provider/model/apiKey/baseUrl config |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| OpenAI-compatible seam misses provider quirks | Med | Keep adapter boundary explicit for provider-specific follow-up |
| Invalid tool args or loops | Med | Validate args and cap iterations |
| App-layer provider logic grows sticky before rust migration | Med | Keep the contract narrow and portable |

## Rollback Plan

Restore the mock route, remove provider-config usage, and keep the provider interface isolated so the rollback does not affect tool or UI wiring.

## Dependencies

- Server-side provider credentials/config for at least one supported adapter path.

## Success Criteria

- [ ] A natural user message receives a real LLM response using config-selected provider settings.
- [ ] `transcribe_video` can be requested, executed client-side, and folded into a final assistant reply.
- [ ] The shipped architecture exposes a provider-agnostic core even if Phase 1 only implements one adapter path.
