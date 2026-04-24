# Proposal: Gemini Adapter — Phase 1

## Intent

Add Gemini as a native provider behind the existing provider-agnostic LLM seam so the agent can use Gemini for plain chat and tool calling without changing orchestrator or route contracts.

## Scope

### In Scope
- Native `GeminiAdapter` implementing the current `ProviderAdapter`
- Gemini free-form chat using existing stateless full-history flow
- Gemini tool calling, with `transcribe_video` as the first real tool
- Config support for `LLM_PROVIDER=gemini`, `LLM_API_KEY`, `LLM_MODEL`
- Tests and env/docs updates while preserving the OpenAI-compatible path

### Out of Scope
- Video/file upload or direct file understanding
- `@asset` references, broader multimodal inputs, and image/video reasoning
- Streaming UX or adapter contract changes for streaming
- Safety/grounding/thinking configuration beyond defaults

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `agent-session-shell`: expand provider selection/configuration so the existing provider adapter contract also supports native Gemini chat and function calling

## Approach

Implement a native Gemini SDK-backed adapter and register it in the provider factory. Keep the adapter stateless by mapping full internal message history into Gemini `generateContent()` requests, converting tool schemas/results at the adapter boundary, and synthesizing tool call IDs so internal contracts stay unchanged.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/web/src/agent/providers/gemini.ts` | New | Gemini request/response/tool conversion |
| `apps/web/src/agent/providers/index.ts` | Modified | Factory registration for `gemini` |
| `apps/web/src/agent/providers/__tests__/gemini.test.ts` | New | Adapter conversion/error tests |
| `apps/web/src/agent/providers/__tests__/index.test.ts` | Modified | Factory coverage |
| `apps/web/package.json` | Modified | Gemini SDK dependency |
| `apps/web/.env.example` | Modified | Gemini env configuration |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Gemini has no tool call IDs | Med | Synthesize unique IDs inside adapter |
| Gemini type casing differs from internal schema | Med | Centralize schema mapping tests |
| Gemini system prompt placement differs | Low | Map system prompt explicitly to Gemini config |

## Rollback Plan

Remove the Gemini adapter, factory branch, dependency, and env docs; keep `openai-compatible` as the unchanged default path.

## Dependencies

- Gemini JS SDK selection to be verified during implementation

## Success Criteria

- [ ] `LLM_PROVIDER=gemini` resolves a native Gemini adapter without breaking `openai-compatible`
- [ ] Gemini returns normal assistant text through the existing route/orchestrator flow
- [ ] Gemini can emit structured tool calls and execute `transcribe_video` through the existing loop
