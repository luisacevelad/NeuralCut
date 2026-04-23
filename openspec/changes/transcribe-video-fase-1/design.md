# Design: `transcribe_video` Phase 1

## Technical Approach

Add a single `transcribe_video` tool that wraps the existing `TranscriptionService` + `decodeAudioToFloat32()` pipeline. The tool resolves the target asset through an extended `EditorContextAdapter`, extracts audio, runs Whisper, and returns a structured `TranscriptionToolResult`. The mock API route triggers it; the orchestrator stores the result in chat state as a `tool_result` message. No new services, no new stores, no timeline mutations.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|----------|--------|----------|-----------|
| Asset file access | Extend `EditorContextAdapter` with `getAssetFile()` | Import `EditorCore` directly in tool | Maintains single-import boundary — only `context.ts` touches `core/` |
| Tool registration | Side-effect import in `orchestrator.ts` (same as `mock.tool.ts`) | Dynamic/lazy registration | Follows existing pattern; tool count is small |
| Asset selection | `assetId` arg → single video/audio → error if ambiguous | Always transcribe first asset | Explicit is better; ambiguous state gets a clear error message |
| Result type | New `TranscriptionToolResult` interface in tool file | Re-export `TranscriptionResult` from lib | Tool result includes `assetName`, `segmentCount`, `duration` — richer than raw `TranscriptionResult` |
| Mock API trigger | Keyword match on "transcri" in user message | Always return `transcribe_video` call | Keeps `echo_context` working for other messages; simple keyword gate |
| Chat rendering | `MessageBubble` detects `tool_result` with transcript shape and formats it | New TranscriptMessage component | Minimal change — one formatting branch inside existing component |

## Data Flow

```
User types "transcribe my video"
  → ChatPanel.handleSend()
    → sendMessage() (chat-store: user msg, loading=true)
    → EditorContextAdapter.getContext() → AgentContext
    → orchestrator.run(messages, context)
      → POST /api/agent/chat → mock API returns { content, toolCalls: [transcribe_video] }
      → resolveToolCalls()
        → toolRegistry.get("transcribe_video").execute(args, context)
          → find asset (context.mediaAssets + EditorContextAdapter.getAssetFile)
          → guard: hasAudio? asset found?
          → decodeAudioToFloat32({ audioBlob: file, sampleRate: 16000 })
          → transcriptionService.transcribe({ audioData, language })
          → return TranscriptionToolResult
      → chatStore.addMessage({ role: "assistant", content, toolCalls })
      → chatStore.addMessage({ role: "tool_result", content: JSON.stringify(result) })
    → agentStore.setStatus("idle"), chatStore.setLoading(false)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/agent/tools/transcribe-video.tool.ts` | Create | Real transcription tool — asset resolution, audio decode, Whisper call, structured result |
| `apps/web/src/agent/context.ts` | Modify | Add `getAssetFile(assetId: string): File \| null` method |
| `apps/web/src/agent/orchestrator.ts` | Modify | Add `import "@/agent/tools/transcribe-video.tool"` (side-effect registration) |
| `apps/web/src/app/api/agent/chat/route.ts` | Modify | Return `transcribe_video` tool call when message contains "transcri", keep `echo_context` fallback |
| `apps/web/src/components/editor/panels/chat/message-bubble.tsx` | Modify | Detect transcript-shaped tool_result and render with timestamps |

## Interfaces / Contracts

```typescript
// apps/web/src/agent/tools/transcribe-video.tool.ts

interface TranscriptionToolResult {
  assetName: string;
  language: string;
  fullText: string;
  segmentCount: number;
  segments: Array<{ text: string; start: number; end: number }>;
  duration: number;
}

// Tool parameters
interface TranscribeVideoArgs {
  assetId?: string;   // optional — resolve automatically if omitted
  language?: string;  // optional — defaults to "auto"
  modelId?: string;   // optional — defaults to whisper-small
}
```

```typescript
// apps/web/src/agent/context.ts — addition

export const EditorContextAdapter = {
  getContext() { /* existing */ },
  getAssetFile(assetId: string): File | null {
    const core = EditorCore.getInstance();
    const asset = core.media.getAssets().find(a => a.id === assetId);
    return asset?.file ?? null;
  },
};
```

## Error States (no UX redesign)

| State | Detection | Response |
|-------|-----------|----------|
| No media assets | `context.mediaAssets.length === 0` | Tool returns `{ error: "No media assets in project" }` — rendered as tool_result error text |
| No video/audio asset | No asset with `type !== "video" && type !== "audio"` | Tool returns `{ error: "No video or audio assets found" }` |
| Asset has no audio | `hasAudio === false` on resolved asset | Tool returns `{ error: "{assetName} has no audio track" }` |
| Multiple candidates, no `assetId` | >1 video/audio asset and no explicit `assetId` arg | Tool returns `{ error: "Multiple video/audio assets found. Specify which one." }` with list of names |
| Transcription service failure | `transcriptionService.transcribe()` rejects | Caught by orchestrator's existing try/catch → `ToolResult.error` message |
| Asset file not found | `getAssetFile()` returns `null` | Tool returns `{ error: "Could not access file for asset {assetId}" }` |

All errors flow through the existing `tool_result` path — no new UI components needed.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Asset selection logic (single/multiple/none) | Pure function test — pass `AgentContext` + `TranscribeVideoArgs`, verify asset resolution |
| Unit | `getAssetFile()` on EditorContextAdapter | Mock `EditorCore.media.getAssets()` return, verify correct file returned |
| Unit | Tool error branches (no audio, no asset, ambiguous) | Mock `decodeAudioToFloat32` and `transcriptionService`, verify error shapes |
| Integration | End-to-end tool execution | Mock only `transcriptionService.transcribe()`, verify full result shape with real `decodeAudioToFloat32` on a small WAV |
| Contract | Tool registration in registry | Verify `toolRegistry.get("transcribe_video")` returns the definition |

## Migration / Rollback

No migration required. Rollback = remove tool import from orchestrator, revert API route to `echo_context` only, revert `MessageBubble` changes.

## Open Questions

- [ ] Should the tool validate `MediaAsset.type === "video" || type === "audio"` or also accept images with embedded audio? (Recommendation: video/audio only for Phase 1)
