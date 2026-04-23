# Exploration: `transcribe_video` Tool — Phase 1

## Current State

### Completed Agent Infrastructure (infra-habilitadora-fase-1)

The full agent pipeline is wired end-to-end with a mock tool. Key components:

- **`agent/types.ts`** — `AgentContext`, `ChatMessage`, `ToolCall`, `ToolResult`, `ToolDefinition`, `ExecutionState`
- **`agent/orchestrator.ts`** — client-side single-pass orchestrator: POST → resolve tool calls → append messages
- **`agent/tools/registry.ts`** — `DefinitionRegistry<string, ToolDefinition>` (generic, reusable)
- **`agent/tools/mock.tool.ts`** — `echo_context` tool (returns context summary)
- **`agent/context.ts`** + **`agent/context-mapper.ts`** — thin adapter reading EditorCore → `AgentContext` POJO
- **`agent/system-prompt.ts`** — builds prompt from `AgentContext`
- **`stores/chat-store.ts`** — messages, loading, error
- **`stores/agent-store.ts`** — execution status, active tool, context snapshot
- **`app/api/agent/chat/route.ts`** — stateless mock API returning canned response with tool call
- **`components/editor/panels/chat/`** — ChatPanel, MessageBubble, ChatInput

The orchestrator is **client-side only**. The API route is a stateless LLM proxy (currently mocked). Tool execution happens in-browser where `EditorCore` is accessible.

### Existing Transcription Infrastructure

A full Whisper-based transcription pipeline already exists:

| File | Role |
|------|------|
| `lib/transcription/types.ts` | `TranscriptionSegment { text, start, end }`, `TranscriptionResult { text, segments, language }`, `TranscriptionStatus`, `TranscriptionModelId` |
| `lib/transcription/models.ts` | 4 Whisper models (tiny → large-v3-turbo), default is whisper-small |
| `lib/transcription/audio.ts` | Sample rate (16000), chunk/stride constants |
| `services/transcription/service.ts` | `TranscriptionService` — Web Worker manager, exposes `transcribe({ audioData, language, modelId, onProgress })` → `TranscriptionResult` |
| `services/transcription/worker.ts` | HuggingFace `@huggingface/transformers` Whisper pipeline in Web Worker |
| `lib/transcription/caption.ts` | `buildCaptionChunks({ segments })` → `CaptionChunk[]` |
| `lib/transcription/diagnostics.ts` | Checks if timeline has audio before enabling transcription |
| `lib/subtitles/insert.ts` | `insertCaptionChunksAsTextTrack({ editor, captions })` — adds text track via `BatchCommand` |

### How the Existing Captions Panel Works

`components/editor/panels/assets/views/captions.tsx` does the full flow:
1. `extractTimelineAudio({ tracks, mediaAssets, totalDuration })` → audio Blob (from **entire timeline**)
2. `decodeAudioToFloat32({ audioBlob, sampleRate: 16000 })` → `{ samples: Float32Array }`
3. `transcriptionService.transcribe({ audioData: samples, language, onProgress })` → `TranscriptionResult`
4. `buildCaptionChunks({ segments })` → `CaptionChunk[]`
5. `insertCaptionChunksAsTextTrack({ editor, captions })` → creates text track

**Critical gap**: The existing flow extracts audio from the **entire timeline** (all tracks mixed). The agent tool needs to transcribe a **specific video/audio asset** — either the one on the main track or one explicitly referenced.

### MediaAsset Structure

`MediaAsset` (`lib/media/types.ts`) extends `MediaAssetData` with `file: File` and `url?: string`. `MediaAssetData` has: `id`, `name`, `type` (image|video|audio), `duration`, `hasAudio`, etc. The `file` property gives direct access to the raw `File` blob for audio extraction.

### Audio Extraction Paths

Two paths exist to get Float32Array audio data:

1. **From the timeline**: `extractTimelineAudio()` → Blob → `decodeAudioToFloat32()` (existing, used by Captions panel)
2. **From a single asset**: `MediaAsset.file` (a `File`/`Blob`) → `decodeAudioToFloat32()` (existing function, just needs the Blob)

Path 2 is the one the agent tool needs. `decodeAudioToFloat32` already takes a `Blob` and returns `Float32Array`. No new audio extraction code is needed.

---

## Affected Areas

- `apps/web/src/agent/tools/transcribe-video.tool.ts` — **new** tool definition
- `apps/web/src/agent/orchestrator.ts` — minor: must import the new tool module (like `mock.tool.ts`)
- `apps/web/src/agent/system-prompt.ts` — likely needs update to describe available tools
- `apps/web/src/app/api/agent/chat/route.ts` — update mock response to return a `transcribe_video` tool call instead of `echo_context`
- `apps/web/src/agent/types.ts` — may need `TranscriptionToolResult` type
- `apps/web/src/lib/transcription/types.ts` — may read/re-export for tool result
- `apps/web/src/services/transcription/service.ts` — consumed by the tool (no changes needed)
- `apps/web/src/lib/media/audio.ts` — `decodeAudioToFloat32()` consumed by the tool (no changes needed)
- `apps/web/src/core/managers/media-manager.ts` — tool reads assets to find the target video (no changes needed)

---

## Approaches

### 1. Thin Agent Tool — Reuse Existing Services, Return TranscriptionResult

Create a `transcribe_video` tool that: (a) reads the active video from `AgentContext.mediaAssets`, (b) extracts audio via `decodeAudioToFloat32`, (c) calls `transcriptionService.transcribe()`, (d) returns a `TranscriptionResult` as the tool result. No caption insertion — that's Phase 2.

- **Pros**: Minimal new code. Reuses battle-tested `TranscriptionService` and `decodeAudioToFloat32`. Clean separation: tool returns data, agent/LLM decides what to do with it.
- **Cons**: Long-running tool (model loading + transcription = 30s-3min depending on model). The orchestrator is single-pass and blocks until the tool completes. No progress reporting to the chat UI during execution.
- **Effort**: Low

### 2. Thin Tool + Progress Reporting

Same as Approach 1, but adds progress callbacks to the tool execution: the tool emits `loading-model`, `transcribing`, and `complete` progress states that the agent store exposes to the chat UI.

- **Pros**: Better UX — user sees "Loading Whisper model... 45%" and "Transcribing..." instead of a frozen "Thinking..." state.
- **Cons**: Requires modifying `ToolDefinition.execute` to support progress reporting (either a callback parameter or a different signature). Also needs the chat panel to render progress states. More surface area.
- **Effort**: Medium

### 3. Thin Tool + Caption Insertion (Bigger Scope)

Same as Approach 1, but the tool also inserts caption chunks into the timeline via `insertCaptionChunksAsTextTrack`.

- **Pros**: End-to-end value — user asks "transcribe my video" and gets captions on the timeline.
- **Cons**: Tool now has a side effect (timeline mutation). Violates "tool returns data, orchestrator decides" principle. Couples the tool to `EditorCore` and `CommandManager`. Should be a separate tool or an explicit follow-up action.
- **Effort**: Medium-High

---

## Recommendation

**Approach 1 — Thin Agent Tool returning TranscriptionResult.** Reasons:

1. **Follows the existing architecture**: Tools are pure data-in/data-out. The LLM decides what to do with the result.
2. **Zero new infra**: The tool wraps `transcriptionService.transcribe()` and `decodeAudioToFloat32()` — both already exist and are tested.
3. **Clear Phase 2 boundary**: Caption insertion, progress reporting, streaming, and multi-turn tool loops are all natural Phase 2 additions that build ON TOP of this.
4. **Fastest vertical slice**: One new file (`transcribe-video.tool.ts`) + minor wiring changes.

### Recommended Tool Design

```typescript
// transcribe-video.tool.ts

const transcribeVideoTool: ToolDefinition = {
  name: "transcribe_video",
  description: "Transcribes the active video's audio using Whisper. Returns text and timestamped segments.",
  parameters: [
    { key: "assetId", type: "string", required: false },
    { key: "language", type: "string", required: false },
    { key: "modelId", type: "string", required: false },
  ],
  execute: async (args, context) => {
    // 1. Find the target asset (by assetId or first video/audio in context)
    // 2. Get the File blob from MediaManager (not in AgentContext — need to extend or read directly)
    // 3. decodeAudioToFloat32({ audioBlob: asset.file, sampleRate: 16000 })
    // 4. transcriptionService.transcribe({ audioData, language, modelId })
    // 5. Return TranscriptionResult
  },
};
```

### Critical Decision: Asset Resolution

The `AgentContext.mediaAssets` array has `id`, `name`, `type`, `duration` but **NOT the `File` blob** (it's intentionally a summary). The tool needs the actual `File` to extract audio. Two options:

- **Option A**: The tool directly reads `EditorCore.media.getAssets()` to get the full `MediaAsset` with `file`. This breaks the "no EditorCore access from agent/" rule. However, the rule only applies to the `agent/` directory, and tools already receive `AgentContext` which could be extended.
- **Option B** (recommended): **Extend `AgentContext`** to include `activeAssetFile: File | null` or use the existing `EditorContextAdapter` pattern — the adapter can resolve the file and pass it as part of the context or as a separate parameter. Since tools already get `AgentContext`, we add an `assetFiles: Map<string, File>` or similar.

Actually, the simplest approach respecting the architecture: **the `transcribe_video` tool's `execute()` function imports `MediaManager` through the same adapter pattern**. The tool lives in `agent/tools/` which is allowed to import from `agent/context.ts`. We extend the adapter to provide asset file access:

```typescript
// Extend agent/context.ts with a resolver
export const EditorContextAdapter = {
  getContext() { ... },
  getAssetFile(assetId: string): File | null {
    const core = EditorCore.getInstance();
    const asset = core.media.getAssets().find(a => a.id === assetId);
    return asset?.file ?? null;
  },
};
```

This keeps the single-import rule (only `context.ts` touches EditorCore) while giving tools access to asset blobs.

### Asset Selection Logic

When the user says "transcribe my video" without specifying which one:

1. If `args.assetId` is provided → use that asset
2. If only one video/audio asset in `context.mediaAssets` → use that one
3. If multiple → return an error asking the user to specify

### What the Tool Returns

```typescript
{
  assetName: string;
  language: string;
  fullText: string;
  segmentCount: number;
  segments: Array<{ text: string; start: number; end: number }>;
  duration: number;
}
```

The full text + segments are returned as the `ToolResult`. The LLM can then summarize, answer questions about the content, or in Phase 2, trigger caption insertion.

### Where the Result Is Stored

- **Tool result** → stored in `chatStore.messages` as a `tool_result` message (existing flow)
- **No persistent storage** in Phase 1 — the transcription is ephemeral, tied to the chat session
- Phase 2 can add persistent transcription storage (IndexedDB, project metadata) and caption insertion

---

## Phase 2 Boundary (explicitly OUT of scope for Phase 1)

| Feature | Why it's Phase 2 |
|---------|-------------------|
| Caption/subtitle insertion into timeline | Side-effect tool, needs separate design |
| Progress reporting during transcription | Requires `ToolDefinition.execute` signature change |
| Streaming transcription results | Requires orchestrator multi-turn support |
| Persistent transcription storage | Needs data model design |
| Multi-language selection UI in chat | UI concern, not tool concern |
| Transcription of timeline (all tracks) vs single asset | Different extraction path, separate tool |
| Real LLM integration (replacing mock API) | Separate change, infrastructure concern |

---

## Risks

1. **Long-running tool execution**: Whisper model loading can take 10-60s, transcription 30s-5min depending on video length and model. The orchestrator is single-pass and the chat UI shows "Thinking..." the entire time. Users may think it's frozen. **Mitigation**: Document this known limitation. Phase 2 adds progress reporting.

2. **Asset file access architecture tension**: The tool needs `MediaAsset.file` (a `File` blob) which is NOT in `AgentContext`. Adding a `getAssetFile()` method to the adapter is clean but expands the adapter's contract. **Mitigation**: The adapter already exists for exactly this purpose — it's the sanctioned bridge.

3. **Web Worker lifecycle**: `transcriptionService` manages a Web Worker with model lifecycle (init → ready). If the tool is called multiple times, the service handles reuse. But if the user switches models, there's a re-init delay. **Mitigation**: No change needed — the existing `TranscriptionService` already handles this correctly.

4. **No real LLM yet**: The API route still returns a canned mock response. The `transcribe_video` tool call must be triggered by the mock, not by a real LLM reasoning about the user's intent. **Mitigation**: Update the mock to return a `transcribe_video` tool call for any message containing "transcribe". This is clearly temporary.

5. **Memory pressure**: Loading a large video's audio as `Float32Array` can consume significant memory. A 10-minute video at 16kHz mono = ~19MB of float data. **Mitigation**: Acceptable for Phase 1. Phase 2 can add chunked processing.

6. **`hasAudio` guard**: Not all video assets have audio. The tool must check `MediaAssetData.hasAudio` before attempting transcription. **Mitigation**: Check in `execute()` and return a clear error message.

---

## Ready for Proposal

**Yes.** The exploration identifies:
- One new file to create (`transcribe-video.tool.ts`)
- Minor wiring changes (orchestrator import, mock API update, adapter extension)
- Clear reuse of existing transcription service and audio decoding
- A clean Phase 2 boundary

**Next**: Run `sdd-propose` with this exploration as input.
