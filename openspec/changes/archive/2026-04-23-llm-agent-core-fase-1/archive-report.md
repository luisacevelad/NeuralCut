# Archive Report: llm-agent-core-fase-1

**Change**: llm-agent-core-fase-1  
**Archived**: 2026-04-23  
**Verdict from verify**: PASS WITH WARNINGS  
**Mode**: hybrid (engram + openspec)

---

## Artifact Traceability (Engram Observation IDs)

| Artifact | Engram Obs ID | Topic Key |
|----------|---------------|-----------|
| Proposal | #982 | sdd/llm-agent-core-fase-1/proposal |
| Spec (reconciled) | #984 | sdd/llm-agent-core-fase-1/spec |
| Design | #985 | sdd/llm-agent-core-fase-1/design |
| Tasks | #987 | sdd/llm-agent-core-fase-1/tasks |
| Apply Progress | #988 | sdd/llm-agent-core-fase-1/apply-progress |
| Verify Report | #998 | sdd/llm-agent-core-fase-1/verify-report |

---

## Specs Synced to Main

| Domain | Action | Details |
|--------|--------|---------|
| agent-session-shell | Updated | 3 requirements replaced (API Proxy Route, Orchestrator Shell, Tool Registry Shell); 4 requirements added (Provider Adapter Interface, Provider Configuration, Tool Argument Validation, Max Iteration Guard); 3 requirements preserved (Chat Store, Agent Store, Shared Foundational Types) |
| agent-context-bridge | Updated | 1 requirement replaced (Context Injection into System Prompt); 3 requirements preserved (AgentContext Contract, EditorContext Adapter, No Direct EditorCore Access) |

---

## Archive Contents (OpenSpec filesystem)

`openspec/changes/archive/2026-04-23-llm-agent-core-fase-1/`
- proposal.md ✅
- specs/agent-session-shell/spec.md ✅
- specs/agent-context-bridge/spec.md ✅
- design.md ✅
- tasks.md ✅
- verify-report.md ✅
- exploration.md ✅
- 22/22 tasks complete

---

## Implementation Summary

Replaced the mock chat route with a real LLM loop using a provider-agnostic adapter architecture. One `openai-compatible` adapter covers OpenAI, Groq, local Ollama, and any `baseUrl`-driven provider. The client-side orchestrator drives a multi-turn tool-call loop with MAX_ITERATIONS = 8, per-tool error recovery, and argument validation. `echo_context` is excluded from the real provider path. `transcribe_video` is the sole registered tool.

**Key files changed**: `apps/web/src/agent/providers/`, `apps/web/src/app/api/agent/chat/route.ts`, `apps/web/src/agent/orchestrator.ts`, `apps/web/src/agent/tools/registry.ts`, `apps/web/src/agent/system-prompt.ts`, `.env.local`, `.env.example`

**Test results**: 60 focused tests pass / 90 total across full change-related suite / TypeScript compiles with zero errors.

---

## Important Warnings (preserved from verify)

1. **Provider-agnostic core verified with one openai-compatible adapter path in Phase 1** — additional native adapters (e.g., Gemini) are future work.
2. **`echo_context` excluded from the real provider path** — still exists for client-side debugging but is never sent to the LLM.
3. **MAX_ITERATIONS = 8 by explicit user choice** — not configurable, hardcoded in orchestrator.
4. **Full `apps/web` suite still has one unrelated migration failure** outside this slice: `src/services/storage/migrations/__tests__/v22-to-v23.test.ts` (284 pass / 1 fail).
5. **Evidence for transcribe tool path is split across focused tests** rather than one dedicated end-to-end runtime test — coverage shape warning, not a correctness issue.

---

## Source of Truth Updated

The following main specs now reflect the new behavior:
- `openspec/specs/agent-session-shell/spec.md`
- `openspec/specs/agent-context-bridge/spec.md`

## SDD Cycle Complete

The change has been fully explored, proposed, specified, designed, tasked, implemented, verified, and archived.
