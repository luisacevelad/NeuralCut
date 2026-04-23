# Tasks: `transcribe_video` Phase 1

## Phase 1: Foundation

- [x] 1.1 Add `resolveAssetFile(assetId?: string): File | null` to `EditorContextAdapter` in `apps/web/src/agent/context.ts` — uses `EditorCore.media.getAssets()` to find by ID or first video/audio, returns `null` on no match
- [x] 1.2 Add `TranscriptionToolResult` and `TranscribeVideoArgs` interfaces at top of new file `apps/web/src/agent/tools/transcribe-video.tool.ts`

## Phase 2: Core Tool

- [x] 2.1 Implement `transcribe_video` tool in `apps/web/src/agent/tools/transcribe-video.tool.ts` — validate `context.mediaAssets`, call `resolveAssetFile`, guard on `hasAudio`/type/ambiguity, then `decodeAudioToFloat32` → `transcriptionService.transcribe` → return `TranscriptionToolResult`
- [x] 2.2 Register tool via side-effect `toolRegistry.register("transcribe_video", …)` at module level (same pattern as `mock.tool.ts`)

## Phase 3: Wiring

- [x] 3.1 Add `import "@/agent/tools/transcribe-video.tool"` to `apps/web/src/agent/orchestrator.ts` (side-effect registration)
- [x] 3.2 Update `apps/web/src/app/api/agent/chat/route.ts` — if last user message contains "transcri" (case-insensitive), return `transcribe_video` tool call; else keep `echo_context` fallback
- [x] 3.3 Update `apps/web/src/components/editor/panels/chat/message-bubble.tsx` — for `tool_result` role, try `JSON.parse(content)` and if it has `fullText` + `segments`, render transcript card with asset name, language, duration, and `[MM:SS] text` segments; else render plain text

## Phase 4: Testing

- [x] 4.1 Unit test `resolveAssetFile()` in `apps/web/src/agent/__tests__/context.test.ts` — mock `EditorCore.media.getAssets()` for: match by ID, fallback to first video, no assets → null
- [x] 4.2 Unit test asset selection + error branches in `apps/web/src/agent/tools/__tests__/transcribe-video.test.ts` — mock `decodeAudioToFloat32` + `transcriptionService`; cover: success path, no audio, no asset, multiple candidates, service failure
- [x] 4.3 Contract test `toolRegistry.has("transcribe_video")` in same test file — verifies registration side-effect
- [x] 4.4 Unit test API route in `apps/web/src/app/api/agent/chat/__tests__/route.test.ts` — "transcribe this" → returns `transcribe_video` call; other message → returns `echo_context` call

## Phase 5: Post-Verify Fixes

- [x] 5.1 Fix TypeScript errors: `jest.fn` type references in test files replaced with explicit `MockFn`/`MockFnFactory` types; `TranscribeVideoArgs.language` typed as `TranscriptionLanguage` instead of `string`
- [x] 5.2 Align tool error messages with spec: `"No active media asset"` for no-asset, `"Asset has no audio track"` for image-only and no-audio-track cases
- [x] 5.3 Wrap decode+transcribe in try/catch — service failures now return `{ error: message }` instead of throwing
- [x] 5.4 Extract `isTranscriptData` + `formatTimestamp` to `transcript-utils.ts`; add 17 behavioral tests proving transcript detection and timestamp formatting
