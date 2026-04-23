# Transcribe Video Specification

## Purpose

End-to-end chat-triggered transcription of one media asset. Decodes the asset's audio, runs Whisper, and returns full text plus timestamped segments.

## Requirements

### Requirement: Transcription Tool Execution

The system SHALL register a `transcribe_video` tool in the tool registry with parameters `{ assetId?: string }`. When executed, the tool MUST resolve the target asset via `EditorContextAdapter.resolveAssetFile(assetId)`, decode its audio to Float32Array using `decodeAudioToFloat32`, and call `transcriptionService.transcribe()` with the decoded audio. The tool MUST return `{ assetName, language, fullText, segments: Array<{ text, start, end }>, duration }`.

#### Scenario: Successful transcription of a video asset

- GIVEN the active/selected asset is a video with an audible audio track
- WHEN `transcribe_video` executes with no explicit `assetId`
- THEN it decodes the asset audio, calls `transcriptionService.transcribe()`, and returns `{ assetName, language, fullText, segments, duration }`
- AND `fullText` is a non-empty string and `segments` contains at least one entry

#### Scenario: Transcription with explicit asset ID

- GIVEN the context has multiple media assets and `assetId` matches one
- WHEN `transcribe_video` executes with `assetId: "v2"`
- THEN it resolves and transcribes that specific asset regardless of active selection

### Requirement: Asset Audio Validation

The tool MUST return an error result when the target asset has no audio track. The tool MUST return an error result when no asset can be resolved (no active/selected asset and no explicit `assetId`).

#### Scenario: Asset with no audio track

- GIVEN the resolved asset is a video file with no audio track
- WHEN `transcribe_video` executes
- THEN the tool returns a `ToolResult` with `error: "Asset has no audio track"`

#### Scenario: Image asset selected

- GIVEN the resolved asset has `type: "image"`
- WHEN `transcribe_video` executes
- THEN the tool returns a `ToolResult` with `error: "Asset has no audio track"`

#### Scenario: No asset resolved

- GIVEN no asset is active/selected and no `assetId` is provided
- WHEN `transcribe_video` executes
- THEN the tool returns a `ToolResult` with `error: "No active media asset"`

### Requirement: Transcription Error Handling

If `transcriptionService.transcribe()` rejects, the tool MUST catch the error and return a `ToolResult` with the error message. The tool MUST NOT throw unhandled exceptions.

#### Scenario: Transcription service fails

- GIVEN the audio decode succeeds but `transcriptionService.transcribe()` throws "Worker not initialized"
- WHEN `transcribe_video` executes
- THEN the tool returns a `ToolResult` with `error` containing "Worker not initialized"
