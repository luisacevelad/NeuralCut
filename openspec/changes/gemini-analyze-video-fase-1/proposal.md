# Proposal: Gemini Analyze Video Phase 1

## Intent

Make Gemini video understanding the primary path for video questions so the agent can inspect the actual selected video, not just a transcript. Keep the API key server-side and avoid widening the existing provider/chat contract.

## Scope

### In Scope
- Add tool `analyze_video` with args `{ assetId?: string, question: string }`.
- Send the resolved video file to a new server route that uploads/polls Gemini Files API and returns a natural-language answer with optional timestamp hints.
- Expose `analyze_video` as the primary video-understanding tool and de-emphasize `transcribe_video` in LLM-visible tool definitions/prompting.

### Out of Scope
- Editing actions or timeline mutations.
- `@asset` UI, streaming/progress UX, and robust caching for large videos.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `agent-session-shell`: tool registry/API proxy behavior now prioritizes `analyze_video` for video understanding instead of `transcribe_video` as the primary exposed tool.
- `agent-context-bridge`: system prompt guidance must describe `analyze_video` as the preferred tool for questions about loaded video assets.

## Approach

Use a dedicated `POST /api/agent/analyze-video` route. The client tool resolves the asset `File`, sends `FormData`, and the server performs Gemini native upload → processing poll → multimodal query. Keep `ProviderAdapter` text-chat only; keep `transcribe_video` registered as standby.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/web/src/agent/tools/analyze-video.tool.ts` | New | Client tool contract and file resolution |
| `apps/web/src/app/api/agent/analyze-video/route.ts` | New | Server-side Gemini Files API flow |
| `apps/web/src/app/api/agent/chat/route.ts` | Modified | LLM-visible tool definitions prioritize `analyze_video` |
| `apps/web/src/agent/system-prompt.ts` | Modified | Prompt guidance prefers video analysis over transcription |
| `apps/web/src/agent/orchestrator.ts` | Modified | Register new tool |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Large upload / long processing | Med | Timeout, clear errors, phase-2 progress/caching |
| SDK File API friction | Med | Fallback to raw REST upload if needed |
| Wrong model lacks video support | Low | Route-level multimodal-capable model fallback |

## Rollback Plan

Remove `analyze_video` wiring, restore `transcribe_video` as the primary exposed tool, and delete the dedicated analyze route.

## Dependencies

- Existing Gemini server SDK and server-side `LLM_API_KEY`
- Existing `EditorContextAdapter.resolveAssetFile()` asset resolution path

## Success Criteria

- [ ] The LLM can call `analyze_video({ assetId?, question })` and receive a natural-language answer about the real video file.
- [ ] API key remains server-only; no client-side Gemini upload logic is introduced.
- [ ] `transcribe_video` remains available as secondary/standby, not the primary exposed video tool.
