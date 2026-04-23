# Proposal: `transcribe_video` Phase 1

## Intent

Ship the first real agent feature: ask the editor chat to transcribe the selected/active media asset and return usable transcript text with timestamps. This proves the current agent shell can drive real product value without adding a new workflow surface.

## Scope

### In Scope
- Add one real `transcribe_video` tool to the current orchestrator/chat flow.
- Reuse existing audio decode + Whisper transcription services for a single media asset.
- Store transcript output in the current chat session and render timestamped segments in chat.
- Extend the context bridge just enough to resolve the selected/active asset file safely.

### Out of Scope
- Subtitle insertion, filler-word cleanup, highlights, summarization, and multi-tool chains.
- Timeline-wide transcription, streaming/progress UX, persistent project-level transcript storage, and real LLM routing.

## Capabilities

### New Capabilities
- `transcribe-video`: End-to-end chat-triggered transcription of one media asset, returning full text plus timestamped segments.

### Modified Capabilities
- `agent-context-bridge`: Expand the sanctioned adapter so tools can safely resolve the selected/active asset file without direct `EditorCore` access.
- `agent-session-shell`: Replace the mock-only tool path with real `transcribe_video` execution and transcript result persistence in chat state.
- `editor-chat-panel`: Render transcript-oriented assistant/tool output with readable timestamps inside the existing chat experience.

## Approach

Keep the slice thin: mock API triggers `transcribe_video`, the tool resolves the target asset through `EditorContextAdapter`, decodes `MediaAsset.file`, calls `transcriptionService.transcribe()`, and returns `{ assetName, language, fullText, segments, duration }`. The orchestrator stores that result in chat state; the chat UI renders the transcript inline.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/web/src/agent/tools/transcribe-video.tool.ts` | New | Real transcription tool |
| `apps/web/src/agent/context.ts` | Modified | Safe asset-file resolver |
| `apps/web/src/agent/orchestrator.ts` | Modified | Execute/store transcript result |
| `apps/web/src/app/api/agent/chat/route.ts` | Modified | Mock trigger for transcription |
| `apps/web/src/components/editor/panels/chat/` | Modified | Timestamped transcript rendering |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Long-running Whisper execution feels frozen | Med | Keep scope explicit; defer progress UX |
| Ambiguous or silent asset selection | Med | Require selected/active asset fallback + clear errors |
| Large files increase memory use | Low | Limit Phase 1 to current in-browser path |

## Rollback Plan

Remove `transcribe_video` registration, restore mock-only route behavior, and keep the chat panel on generic message rendering.

## Dependencies

- Existing `TranscriptionService`, `decodeAudioToFloat32()`, and current asset/editor context.

## Success Criteria

- [ ] A chat request can trigger `transcribe_video` for the selected/active media asset.
- [ ] The result appears in chat with transcript text and timestamped segments.
- [ ] Asset access stays behind `EditorContextAdapter`, with no direct `core/` imports from agent modules.
