# Delta for Agent Context Bridge

## MODIFIED Requirements

### Requirement: Context Injection into System Prompt

The system SHALL provide a `buildSystemPrompt(context: AgentContext)` function that produces a system prompt string including the media summary AND guidance about available tools. When `mediaAssets` is empty, the prompt MUST still be valid but indicate no media loaded. The prompt MUST instruct the LLM that it can call tools from a known set (currently `transcribe_video`) and that it should respond in plain text when no tool is needed. The system prompt template MUST be separate from the orchestrator logic and MUST be consumable by the server route (i.e., a pure function with no client-only dependencies).

(Previously: System prompt included only editor/project context and media summary, no tool guidance, no server-consumption constraint.)

#### Scenario: Prompt includes media context and tool guidance

- GIVEN `AgentContext` with `mediaAssets: [{ id: "v1", name: "clip.mp4", type: "video", duration: 30 }]`
- WHEN `buildSystemPrompt(context)` is called
- THEN the returned string contains "clip.mp4", "video", and references "transcribe_video" as an available tool

#### Scenario: Prompt without media

- GIVEN `AgentContext` with `mediaAssets: []`
- WHEN `buildSystemPrompt(context)` is called
- THEN the returned string is valid, contains "No media assets loaded", and still references available tools

#### Scenario: Server-side consumption

- GIVEN `buildSystemPrompt` is imported in the API route
- WHEN the route calls `buildSystemPrompt(context)`
- THEN it returns a string without importing any client-only modules (no `EditorCore`, no WASM, no browser APIs)
