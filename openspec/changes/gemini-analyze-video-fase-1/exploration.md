# Exploration: `analyze_video` — Gemini Video Understanding (Phase 1)

## Current State

### Shipped infrastructure

Three completed changes underpin this work:

| Change | What shipped |
|--------|-------------|
| `infra-habilitadora-fase-1` | Full agent pipeline: orchestrator (client-side), tool registry, mock tool, context adapter, system prompt, chat UI |
| `gemini-adapter-fase-1` | `GeminiAdapter` behind `ProviderAdapter` seam — text-only `chat()` via `@google/generative-ai` v0.24.0 |
| `transcribe-video-fase-1` | `transcribe_video` tool — Whisper-based, client-side execution, returns `TranscriptionToolResult` with segments + timestamps. Fully implemented and verified. |

### How the agent pipeline works today

```
User message → ChatPanel → orchestrator.run(messages, context)
  → POST /api/agent/chat (server)
    → createProvider(config) → GeminiAdapter.chat({ messages, systemPrompt, tools })
      → model.generateContent({ contents, systemInstruction, tools })
    → { content, toolCalls? }
  → resolveToolCalls(toolCalls, context) (client)
    → toolRegistry.get(name).execute(args, context)
    → ToolResult → appended as tool_result message
  → Loop back to POST (max 8 iterations)
```

**Key architectural facts**:
- **Server route** (`route.ts`): Stateless, holds `LLM_API_KEY`, creates adapter, calls `chat()`. Exposes tool schemas to the LLM but NEVER executes tools.
- **Client orchestrator**: Holds `AgentContext`, resolves tool calls, executes tools in-browser where `EditorCore` is accessible.
- **Tools are client-side only**: `ToolDefinition.execute()` runs in the browser, has access to `EditorContextAdapter.resolveAssetFile()` and `EditorCore`.
- **Tool schemas are duplicated**: `route.ts` has `providerToolDefs` (stub `execute`) for the LLM; `toolRegistry` has real definitions for execution.

### Gemini SDK already installed

`@google/generative-ai` v0.24.0 is in `apps/web/package.json`. The `GeminiAdapter` uses `GoogleGenerativeAI` → `getGenerativeModel()` → `generateContent()`. The SDK also exports:

- **`GoogleAIFileManager`** from `@google/generative-ai/server` — server-side file upload/management
- **`FileState`** enum — `PROCESSING`, `ACTIVE`, `FAILED`
- **`FileDataPart`** — `{ fileData: { fileUri, mimeType } }` content part for `generateContent()`

### EditorContextAdapter

Already provides the sanctioned path for tools to obtain a `File`:

```ts
EditorContextAdapter.resolveAssetFile(assetId?: string): File | null
EditorContextAdapter.getAssetHasAudio(assetId: string): boolean | undefined
```

---

## Affected Areas

| File | Why affected |
|------|-------------|
| `apps/web/src/agent/tools/analyze-video.tool.ts` | **NEW** — `analyze_video` tool definition (client-side) |
| `apps/web/src/app/api/agent/analyze-video/route.ts` | **NEW** — server route: upload video to Gemini File API + poll + query |
| `apps/web/src/agent/orchestrator.ts` | Add side-effect import of new tool |
| `apps/web/src/app/api/agent/chat/route.ts` | Add `analyze_video` to `providerToolDefs`, optionally remove/demote `transcribe_video` |
| `apps/web/src/agent/system-prompt.ts` | May update guidance to prefer `analyze_video` |
| `apps/web/src/components/editor/panels/chat/message-bubble.tsx` | May add rendering for `AnalyzeVideoResult` shape |

**Unchanged** (confirmed safe):
- `providers/gemini.ts` — adapter handles text chat; video goes through a separate route using `GoogleAIFileManager`
- `providers/types.ts` — `ProviderAdapter` contract unchanged
- `agent/types.ts` — `AgentContext`, `ToolDefinition` unchanged
- `agent/context.ts` — `resolveAssetFile()` already returns `File`
- `tools/transcribe-video.tool.ts` — stays registered, just de-emphasized in tool list

---

## Critical Constraint: File API Is Server-Side Only

The Gemini Files API requires the API key and can only be called server-side. The current architecture has tools executing **client-side**. This means `analyze_video` cannot be a pure client-side tool like `transcribe_video`. It needs a **server route** to handle the upload-to-Gemini flow.

### Proposed flow

```
LLM decides: analyze_video({ assetId: "v1", question: "What happens in this video?" })
  → Client orchestrator resolves tool call
    → tool.execute(args, context)
      → EditorContextAdapter.resolveAssetFile("v1") → File blob
      → POST /api/agent/analyze-video (FormData: video file + question + assetId)
        → Server: GoogleAIFileManager.uploadFile(buffer, { mimeType, displayName })
        → Server: poll file.state until ACTIVE (or timeout)
        → Server: model.generateContent([ question, { fileData: { fileUri, mimeType } }])
        → Server: return { answer, duration, ... }
      → Tool returns structured AnalyzeVideoResult
```

### Why not inline base64?

Gemini supports `InlineDataPart` with base64-encoded video, but:
- **Size limit**: Inline data is practical only for files under ~20MB raw (~27MB base64). Real video projects regularly exceed this.
- **No reuse**: The file is sent every call. The File API gives a `fileUri` that persists (up to 48h free / 7d paid), enabling reuse.
- **Processing state**: The File API handles video decoding, audio extraction, and indexing server-side. Inline data forces the model to process on every call.

**Verdict**: Use the File API for production readiness. Phase 1 uses the File API exclusively.

---

## Approaches

### 1. Dedicated `/api/agent/analyze-video` Route (Recommended)

Create a new server route that handles the full upload→poll→query flow. The client-side tool sends the video file as FormData, the server does everything Gemini-side, and returns a structured answer.

- **Pros**:
  - Clean separation: upload+analyze logic is entirely server-side (no API key leakage)
  - Reuses existing `GeminiAdapter` pattern (same SDK, same config)
  - The tool on the client side is thin — just FormData construction and response parsing
  - Natural place for future caching (fileUri by assetId)
  - Can report processing progress via streaming in Phase 2
- **Cons**:
  - New route to maintain
  - Large FormData upload adds latency (video files can be hundreds of MB)
  - Polling loop blocks the server request (video processing can take 30s-5min for long videos)
- **Effort**: Medium

### 2. Extend `/api/agent/chat` Route for Multimodal

Add multimodal content support to the existing chat route. The client sends video content parts alongside text messages. The server handles upload transparently within the adapter.

- **Pros**:
  - Single route, single contract
  - More "correct" architecturally — the chat route becomes multimodal
- **Cons**:
  - **Major refactor of the adapter contract** — `ProviderAdapter.chat()` currently takes text-only `ChatMessage[]`. Adding binary content parts requires interface changes to `ChatMessage`, `ProviderAdapter`, and both adapters.
  - Breaks the clean text-only abstraction that `route.ts` depends on
  - The upload/poll cycle doesn't fit neatly into the synchronous `chat()` call
  - Cross-contaminates text chat and file upload concerns
- **Effort**: High

### 3. Upload-Then-Chat Two-Step

Split into two routes: `POST /api/agent/upload-video` (upload + poll → return fileUri) and `POST /api/agent/chat` (modified to accept fileUri references). The client tool orchestrates both calls.

- **Pros**:
  - Separation of upload and query concerns
  - fileUri can be cached client-side and reused across queries without re-uploading
- **Cons**:
  - Two round trips for a single tool call (upload, then query)
  - Client must manage fileUri lifecycle (when to re-upload)
  - More complex tool execution logic
  - The chat route still needs multimodal content support (same con as Approach 2)
- **Effort**: Medium-High

---

## Recommendation

**Approach 1: Dedicated `/api/agent/analyze-video` route.**

Rationale:
1. **Minimal contract changes**: No changes to `ProviderAdapter`, `ChatMessage`, or the existing chat route. The new route is self-contained.
2. **API key safety**: All Gemini interaction happens server-side. The client tool only sends a FormData blob.
3. **Matches the existing pattern**: Just as `transcribe_video` is a client tool that calls services, `analyze_video` is a client tool that calls a server endpoint. The server endpoint is the Gemini File API equivalent of the transcription service.
4. **Cache-friendly**: The route can return the `fileUri` in the response, and in Phase 2, we add a KV cache (Upstash Redis is already installed) keyed by `assetId` to skip re-uploads.
5. **Thin scope**: The tool is `analyze_video({ assetId?, question })` → answer. No editing actions, no timeline mutations.

---

## Recommended Tool Design

```typescript
// analyze-video.tool.ts

interface AnalyzeVideoArgs {
  assetId?: string;
  question: string;
}

interface AnalyzeVideoResult {
  assetName: string;
  question: string;
  answer: string;
  duration: number;
}

// OR error:
interface AnalyzeVideoError {
  error: string;
}
```

### Server route contract

```
POST /api/agent/analyze-video
Content-Type: multipart/form-data

Fields:
  - video: File (the video blob)
  - question: string
  - assetId: string (for display/logging)
  - mimeType: string (e.g., "video/mp4")

Response:
  { answer: string, duration: number }
  OR { error: string }
```

### Processing on the server

```
1. Parse FormData → extract video buffer + question + mimeType
2. GoogleAIFileManager.uploadFile(buffer, { mimeType, displayName: assetId })
3. Poll file.state every 5s until ACTIVE (max 120s timeout)
4. model.generateContent([
     { text: question },
     { fileData: { fileUri: file.uri, mimeType: file.mimeType } }
   ])
5. Return { answer: response.text(), duration }
```

### Asset resolution

Reuses the same pattern as `transcribe_video`:
1. If `assetId` provided → resolve that specific asset
2. If only one video/audio asset → use it
3. If multiple → return error asking user to specify

### De-emphasizing `transcribe_video`

In `route.ts`, replace `transcribe_video` in `providerToolDefs` with `analyze_video`. The tool stays registered in the client-side registry (available if needed) but the LLM no longer sees it in its tool list.

```typescript
// route.ts — updated providerToolDefs
const providerToolDefs: ToolDefinition[] = [
  {
    name: "analyze_video",
    description: "Analyzes a video using Gemini multimodal understanding. Can answer questions about visual content, audio, speech, and overall composition. Returns a structured answer.",
    parameters: [
      { key: "assetId", type: "string", required: false },
      { key: "question", type: "string", required: true },
    ],
    execute: async () => ({}), // stub — never called server-side
  },
];
```

---

## Caching Considerations (Phase 1 vs Phase 2)

### Phase 1 (this change): No caching
- Every `analyze_video` call uploads the video fresh
- Simple, predictable, no state management
- Downside: redundant uploads for repeated questions about the same video

### Phase 2: File URI cache via Upstash Redis
- `Upstash Redis` is already a project dependency (`@upstash/redis`, `@upstash/ratelimit`)
- Key: `gemini-file:{sha256hash}` or `gemini-file:{assetId}:{fileSize}`
- Value: `{ fileUri, mimeType, expiresAt }`
- On each call: check cache → if valid, skip upload → use cached fileUri
- Need to handle: file mutation (re-upload if asset changes), TTL alignment with Gemini's expiration

---

## Risks

1. **Upload size and latency**: Video files can be 100MB+. Uploading to the Gemini File API from a server route adds significant latency. The Next.js route has a default body size limit that may need configuration. **Mitigation**: Phase 1 sets a reasonable max file size (e.g., 500MB). Configure `bodySizeLimit` in the Next.js route config.

2. **Processing polling blocks the request**: After upload, Gemini needs to process the video (decode frames, extract audio, index). For long videos this can take minutes. The server route holds open during polling. **Mitigation**: Set a polling timeout (e.g., 120s). Return a clear error if processing exceeds the limit. Phase 2 can add async processing with a status check endpoint.

3. **SDK uploadFile takes file path, not Buffer**: The `GoogleAIFileManager.uploadFile()` API officially takes a `filePath: string`. The docs mention `Buffer` support in the API review, but the TypeScript types may not reflect this. **Mitigation**: If `uploadFile` doesn't accept Buffer directly, use the raw Gemini REST API (`POST /upload/v1beta/files`) with `fetch` for the upload, then use the SDK for `generateContent`. OR write to `/tmp` (works in Node.js but not ideal in serverless).

4. **`@google/generative-ai` is "deprecated"**: Context7 marks this SDK as deprecated, superseded by `@google/genai`. The newer SDK may have better File API support. **Mitigation**: Phase 1 ships with `@google/generative-ai` (already installed). Note SDK migration as Phase 2 tech debt. The File API behavior is identical across SDKs — only the client library wrapper differs.

5. **Model availability**: Video understanding requires Gemini 2.5 Flash or Pro (or 1.5 Pro). If the user's `LLM_MODEL` is set to a text-only model, the analyze route needs a separate model config. **Mitigation**: The analyze route reads `LLM_MODEL` but can fall back to `gemini-2.5-flash` if the configured model doesn't support multimodal. Or add a separate `GEMINI_VIDEO_MODEL` env var.

6. **Serverless timeout**: Next.js on Cloudflare (the deployment target) has request timeout limits. Video processing may exceed these. **Mitigation**: Phase 1 targets local development first. For Cloudflare deployment, use a background worker or queue system in Phase 2.

7. **API key exposure surface**: The new route handles file uploads and must validate inputs carefully to prevent abuse. **Mitigation**: Use the existing `@upstash/ratelimit` for rate limiting. Validate file MIME type server-side.

8. **No structured timestamps in Phase 1**: Gemini's response about a video includes natural language time references ("at 0:45 the camera pans") but not structured timestamp objects. **Mitigation**: Accept natural language in Phase 1. Phase 2 can add prompt engineering or response parsing for structured timestamps.

---

## Ready for Proposal

**Yes.** The exploration identifies:
- One new client-side tool file (`analyze-video.tool.ts`)
- One new server route (`/api/agent/analyze-video/route.ts`)
- Minor wiring changes (orchestrator import, route tool defs update)
- Clear de-emphasis path for `transcribe_video`
- No changes to `ProviderAdapter`, `ChatMessage`, or existing adapter code
- Clear Phase 2 boundary (caching, structured timestamps, progress reporting, async processing)

**Next**: Run `sdd-propose` with this exploration as input.
