# Delta for Agent Session Shell

## MODIFIED Requirements

### Requirement: Tool Registry Shell

The system SHALL provide a `ToolRegistry` extending `DefinitionRegistry<string, ToolDefinition>` where `ToolDefinition` contains `{ name, description, parameters, execute: (args, context) => Promise<unknown> }`. The registry MUST register `echo_context` and `transcribe_video`. The registry MUST support `register`, `get`, `has`, and `getAll`.

(Previously: Registry registered exactly one tool — `echo_context`.)

#### Scenario: Mock echo tool executes

- GIVEN `echo_context` is registered with `execute: (args, ctx) => ({ projectId: ctx.projectId, ... })`
- WHEN `registry.get("echo_context").execute({}, context)` is called
- THEN it returns a context summary with projectId and mediaCount

#### Scenario: Transcribe tool is registered

- GIVEN the `transcribe_video` tool module is imported
- WHEN `registry.has("transcribe_video")` is called
- THEN it returns `true`

### Requirement: API Proxy Route

The system SHALL expose `POST /api/agent/chat` that accepts `{ messages: ChatMessage[], context?: AgentContext }` and returns `{ content: string, toolCalls?: ToolCall[] }`. In this phase, the route MUST return a canned mock response — no real LLM call. When the last user message contains transcription-related intent (e.g., "transcribe"), the route MUST return a `transcribe_video` tool call. Otherwise, it MUST return the existing `echo_context` tool call. The route MUST validate the request body schema and return 400 on invalid input.

(Previously: Route always returned `echo_context` tool call regardless of user intent.)

#### Scenario: Valid request returns mock response

- GIVEN a POST request with valid `{ messages: [{ role: "user", content: "Hi" }] }`
- WHEN the handler processes the request
- THEN it returns 200 with `{ content: "...", toolCalls: [{ name: "echo_context", ... }] }`

#### Scenario: Transcription intent triggers transcribe tool

- GIVEN a POST request with `{ messages: [{ role: "user", content: "Transcribe this video" }] }`
- WHEN the handler processes the request
- THEN it returns 200 with `{ content: "...", toolCalls: [{ name: "transcribe_video", args: {} }] }`

#### Scenario: Invalid request returns 400

- GIVEN a POST request with `{}` (missing `messages`)
- WHEN the handler processes the request
- THEN it returns 400 with an error description
