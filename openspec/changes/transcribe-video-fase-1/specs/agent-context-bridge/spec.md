# Delta for Agent Context Bridge

## ADDED Requirements

### Requirement: Active Asset File Resolver

The system SHALL provide `resolveAssetFile(assetId?: string)` on `EditorContextAdapter` that returns the `File` reference for the requested media asset. When `assetId` is provided, it MUST resolve that specific asset. When omitted, it MUST resolve the first video/audio asset from `mediaAssets`. The method SHALL return `null` when no matching asset exists. This method is the ONLY sanctioned path for tools to obtain a `File` reference — tools MUST NOT access `EditorCore.media` directly.

#### Scenario: Resolve by explicit asset ID

- GIVEN `EditorCore.media.getAssets()` contains an asset with `id: "v1"` and `name: "clip.mp4"`
- WHEN `resolveAssetFile("v1")` is called
- THEN it returns the `File` object for that asset

#### Scenario: Resolve active asset without ID

- GIVEN `EditorCore.media.getAssets()` contains two assets, the first being a video
- WHEN `resolveAssetFile()` is called without arguments
- THEN it returns the `File` for the first video or audio asset

#### Scenario: No matching asset

- GIVEN `EditorCore.media.getAssets()` is empty
- WHEN `resolveAssetFile()` is called
- THEN it returns `null`

#### Scenario: Asset ID not found

- GIVEN `EditorCore.media.getAssets()` contains assets with IDs `["v1", "v2"]`
- WHEN `resolveAssetFile("v99")` is called
- THEN it returns `null`
