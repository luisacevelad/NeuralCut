# Delta for Agent Session Shell

## ADDED Requirements

### Requirement: Provider Adapter Interface

The system SHALL define a server-side provider adapter interface with a single method `chat(params: ProviderChatParams): Promise<ProviderChatResponse>`. `ProviderChatParams` MUST include `messages`, `systemPrompt`, and `toolSchemas` in a provider-agnostic internal format. `ProviderChatResponse` MUST include `content: string` and `toolCalls?: ProviderToolCall[]` where `ProviderToolCall { id, name, args }`. Each concrete adapter converts internal tool schemas to its own wire format. Phase 1 MAY ship exactly one adapter (OpenAI-compatible) as long as the interface contract remains provider-agnostic.

#### Scenario: Adapter translates tool schemas to wire format

- GIVEN `transcribe_video` has internal parameters `[{ key: "assetId", type: "string", required: false }]`
- WHEN the adapter receives tool schemas before calling the provider
- THEN it converts them to its provider-specific wire format

#### Scenario: Adapter selected by config

- GIVEN `LLM_PROVIDER` is set to `"openai-compatible"`
- WHEN the route resolves the adapter
- THEN the OpenAI-compatible adapter is returned

### Requirement: Provider Configuration

Server-only environment variables `LLM_PROVIDER` (required), `LLM_MODEL` (required), `LLM_API_KEY` (required), and `LLM_BASE_URL` (optional) MUST determine which adapter and model the route uses. Configuration MUST be read server-side only — never exposed to the client.

#### Scenario: Missing required configuration

- GIVEN `LLM_API_KEY` is not set in the environment
- WHEN the route attempts to initialize the provider
- THEN the call returns 502 with a missing-configuration error

### Requirement: Tool Argument Validation

Before executing any tool call, the orchestrator MUST validate that each argument key declared `required: true` in the tool's `parameters` is present in the call args and is of the declared type. If validation fails, the tool MUST NOT execute; instead the orchestrator MUST produce a `ToolResult` with `error` describing the missing or malformed argument.

#### Scenario: Missing required argument

- GIVEN `transcribe_video` declares no required parameters and the LLM returns `toolCalls: [{ name: "transcribe_video", args: {} }]`
- WHEN the orchestrator validates args
- THEN validation passes and the tool executes

#### Scenario: Wrong argument type

- GIVEN a tool declares `{ key: "assetId", type: "string", required: true }`
- AND the LLM returns `args: { assetId: 123 }`
- WHEN the orchestrator validates args
- THEN the tool does NOT execute and a `ToolResult` with `error` containing "assetId" is returned

### Requirement: Max Iteration Guard

The orchestrator loop MUST enforce a hard iteration cap of **8**. An iteration is one round of "call provider → resolve tool calls → feed results back." If the cap is reached, the orchestrator MUST stop, append a final assistant message indicating the limit was reached, and set `agentStore.status` to `"idle"`.

#### Scenario: Cap reached mid-loop

- GIVEN the provider has returned tool calls on 7 consecutive iterations
- WHEN iteration 8 also returns tool calls
- THEN the orchestrator stops, appends "Reached maximum iteration limit" to `chatStore`, and sets status to `"idle"`

#### Scenario: Loop completes within cap

- GIVEN the provider returns a final text response after 2 tool-call iterations
- WHEN the orchestrator processes the response
- THEN no cap message is appended and status is `"idle"`

## MODIFIED Requirements

### Requirement: API Proxy Route

The system SHALL expose `POST /api/agent/chat` that accepts `{ messages: ChatMessage[], context?: AgentContext }` and returns `{ content: string, toolCalls?: ToolCall[] }`. The route MUST resolve the provider adapter from configuration, assemble a system prompt via `buildSystemPrompt(context)`, and pass internal tool schemas from the registry to the adapter. The adapter handles all provider-specific wire-format conversion. The request body MUST be validated via zod; invalid input returns 400. Provider errors return 502.

(Previously: Route used `openai` SDK directly with `OPENAI_API_KEY`/`OPENAI_BASE_URL`/`OPENAI_MODEL` env vars and `toolRegistryToOpenAITools()`.)

#### Scenario: Valid request returns provider response

- GIVEN provider config is set and a POST with valid `{ messages, context }` arrives
- WHEN the handler calls through the provider adapter
- THEN it returns 200 with `{ content: "...", toolCalls?: [...] }`

#### Scenario: Invalid request returns 400

- GIVEN a POST request with `{}` (missing `messages`)
- WHEN the handler processes the request
- THEN it returns 400 with an error description

#### Scenario: Provider error returns 502

- GIVEN the provider adapter call throws a network or auth error
- WHEN the handler catches it
- THEN it returns 502 with `{ error: "LLM provider error" }`

### Requirement: Orchestrator Shell

The system SHALL provide a client-side `orchestrator.run(messages, context)` function that iterates: (1) sets `agentStore.status` to `"sending"`, (2) POSTs `{ messages, context }` to `/api/agent/chat`, (3) if the response contains `toolCalls`, validates args, resolves each via the tool registry (if a single tool throws, the error MUST be captured in a `ToolResult` and the loop MUST continue so the LLM can recover), appends tool results to the message history, and loops back to step 2 with the updated history, (4) when the response has no `toolCalls`, appends the final assistant message to `chatStore`, sets status to `"idle"`. The loop MUST NOT exceed the max iteration guard. On API or network errors (not per-tool errors), the orchestrator MUST set `chatStore.error` and `agentStore.status` to `"error"`.

(Previously: Single-pass orchestrator — one API call, no loop, no iteration cap.)

#### Scenario: Happy path with no tool calls

- GIVEN `chatStore` has one user message and the API returns `{ content: "Hello!", toolCalls: [] }`
- WHEN `orchestrator.run()` is invoked
- THEN `chatStore.messages` contains the assistant reply "Hello!"
- AND `agentStore.status` is `"idle"`

#### Scenario: Tool call then final answer

- GIVEN iteration 1 returns `{ content: "", toolCalls: [{ name: "transcribe_video", args: {} }] }`
- AND the tool executes successfully
- AND iteration 2 returns `{ content: "Here is the transcription...", toolCalls: [] }`
- WHEN the orchestrator loop completes
- THEN `chatStore.messages` contains the tool result AND the final assistant message
- AND `agentStore.status` is `"idle"`

#### Scenario: Error during tool execution — per-tool recovery

- GIVEN iteration 1 returns `{ content: "", toolCalls: [{ name: "transcribe_video", args: {} }] }` and the tool throws
- WHEN the orchestrator catches the error inside `resolveToolCalls`
- THEN a `ToolResult` with the error description is appended to the message history
- AND the loop continues, sending tool-result back to the LLM for a final answer

### Requirement: Tool Registry Shell

The system SHALL provide a `ToolRegistry` extending `DefinitionRegistry<string, ToolDefinition>` where `ToolDefinition` contains `{ name, description, parameters, execute }`. The registry MUST support `register`, `get`, `has`, `getAll`, and a `toToolSchemas()` method that exports every registered tool's parameters in a provider-agnostic internal schema format. The provider adapter is responsible for converting these internal schemas to its specific wire format. In this phase `echo_context` MUST NOT be registered; exactly one tool — `transcribe_video` — MUST be registered.

(Previously: Registry exported `toOpenAISchemas()` producing OpenAI function-calling format directly; `echo_context` was the only registered tool.)

#### Scenario: Schema export produces internal format

- GIVEN `transcribe_video` is registered with parameters `[{ key: "assetId", type: "string", required: false }, ...]`
- WHEN `toToolSchemas()` is called
- THEN it returns an array with one entry containing `{ name: "transcribe_video", description, parameters: [...] }` in the internal format
