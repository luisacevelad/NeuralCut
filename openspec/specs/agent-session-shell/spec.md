# Agent Session Shell Specification

## Purpose

Defines the client-side orchestration boundary between the UI layer, the API proxy, Zustand stores, and the tool registry. The route delegates to a config-selected provider adapter for real LLM execution, and the orchestrator drives a multi-turn tool-call loop with iteration guard and argument validation.

## Requirements

### Requirement: Chat Store

The system SHALL maintain a `chatStore` (Zustand) with state: `messages: ChatMessage[]`, `loading: boolean`, `error: string | null`. The store MUST provide `addMessage(msg)`, `setLoading(v)`, `setError(e)`, and `clearMessages()` actions. The store MUST follow the existing `create<State>()(persist(...))` pattern used by other stores in the project.

#### Scenario: Message lifecycle

- GIVEN `chatStore` is initialized with empty messages
- WHEN `addMessage({ role: "user", content: "Hello" })` is called
- THEN `chatStore.messages` contains one entry with the correct role and content

#### Scenario: Error state persists until cleared

- GIVEN `setError("API failed")` was called
- WHEN the UI reads `chatStore.error`
- THEN it returns `"API failed"`
- AND `chatStore.loading` is `false`

### Requirement: Agent Store

The system SHALL maintain an `agentStore` (Zustand) with state: `status: ExecutionStatus`, `activeTool: string | null`, `context: AgentContext | null`. The store MUST provide `setStatus`, `setActiveTool`, `setContext`, and `reset` actions.

#### Scenario: Tool execution tracking

- GIVEN the orchestrator begins executing tool `echo_context`
- WHEN `setActiveTool("echo_context")` and `setStatus("processing")` are called
- THEN `agentStore.activeTool` is `"echo_context"` and `agentStore.status` is `"processing"`

#### Scenario: Reset after completion

- GIVEN `agentStore` has `status: "processing"` and `activeTool: "echo_context"`
- WHEN `reset()` is called
- THEN `status` is `"idle"` and `activeTool` is `null`

### Requirement: API Proxy Route

The system SHALL expose `POST /api/agent/chat` that accepts `{ messages: ChatMessage[], context?: AgentContext }` and returns `{ content: string, toolCalls?: ToolCall[] }`. The route MUST resolve the provider adapter from configuration, assemble a system prompt via `buildSystemPrompt(context)`, and pass internal tool schemas from the registry to the adapter. The adapter handles all provider-specific wire-format conversion. The request body MUST be validated via zod; invalid input returns 400. Provider errors return 502.

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

#### Scenario: Schema export produces internal format

- GIVEN `transcribe_video` is registered with parameters `[{ key: "assetId", type: "string", required: false }, ...]`
- WHEN `toToolSchemas()` is called
- THEN it returns an array with one entry containing `{ name: "transcribe_video", description, parameters: [...] }` in the internal format

### Requirement: Shared Foundational Types

The system SHALL define types in `apps/web/src/agent/types.ts`: `ChatMessage { id, role, content, toolCalls?, timestamp }`, `ToolCall { id, name, args }`, `ToolResult { toolCallId, name, result, error? }`, `ExecutionState = "idle" | "sending" | "processing" | "responding" | "error"`, `AgentContext { projectId, activeSceneId, mediaAssets, playbackTimeMs }`, `ToolDefinition { name, description, parameters, execute }`. These types MUST be the single source of truth shared across stores, orchestrator, registry, and API route.

#### Scenario: Types are importable everywhere

- GIVEN `types.ts` exports `ChatMessage`, `ToolCall`, `ToolResult`, `ExecutionState`, `AgentContext`, `ToolDefinition`
- WHEN any module in `agent/`, `stores/`, or `app/api/agent/` imports from it
- THEN TypeScript compiles without errors

### Requirement: Provider Adapter Interface

The system SHALL define a server-side provider adapter interface with a single method `chat(params: ProviderChatParams): Promise<ProviderChatResponse>`. `ProviderChatParams` MUST include `messages`, `systemPrompt`, and `toolSchemas` in a provider-agnostic internal format. `ProviderChatResponse` MUST include `content: string` and `toolCalls?: ProviderToolCall[]` where `ProviderToolCall { id, name, args }`. Each concrete adapter converts internal tool schemas to its own wire format. The factory MUST support at least `openai-compatible` and `gemini` providers. Adapters whose native API does not assign IDs to tool calls MUST synthesize unique IDs so every returned `ToolCall.id` is a non-empty string.

#### Scenario: Adapter translates tool schemas to wire format

- GIVEN `transcribe_video` has internal parameters `[{ key: "assetId", type: "string", required: false }]`
- WHEN the adapter receives tool schemas before calling the provider
- THEN it converts them to its provider-specific wire format

#### Scenario: Adapter selected by config — OpenAI-compatible

- GIVEN `LLM_PROVIDER` is set to `"openai-compatible"`
- WHEN the route resolves the adapter
- THEN the OpenAI-compatible adapter is returned

#### Scenario: Adapter selected by config — Gemini

- GIVEN `LLM_PROVIDER` is set to `"gemini"`
- WHEN the route resolves the adapter
- THEN the Gemini adapter is returned

#### Scenario: Gemini adapter synthesizes tool-call IDs

- GIVEN the Gemini API returns a function call response with no call ID
- WHEN the Gemini adapter maps the response to `ProviderResponse`
- THEN each `ToolCall` in `toolCalls` has a non-empty `id` field generated by the adapter

### Requirement: Provider Configuration

Server-only environment variables `LLM_PROVIDER` (required), `LLM_MODEL` (required), `LLM_API_KEY` (required), and `LLM_BASE_URL` (optional) MUST determine which adapter and model the route uses. `LLM_PROVIDER` MUST accept at least `"openai-compatible"` and `"gemini"`. When `LLM_PROVIDER` is `"gemini"`, `LLM_BASE_URL` MUST be ignored. Configuration MUST be read server-side only — never exposed to the client.

#### Scenario: Missing required configuration

- GIVEN `LLM_API_KEY` is not set in the environment
- WHEN the route attempts to initialize the provider
- THEN the call returns 502 with a missing-configuration error

#### Scenario: Unknown provider

- GIVEN `LLM_PROVIDER` is set to `"unknown-provider"`
- WHEN the route resolves the adapter
- THEN the factory throws `"Unknown LLM provider: unknown-provider"`

#### Scenario: Gemini config ignores base URL

- GIVEN `LLM_PROVIDER` is `"gemini"` and `LLM_BASE_URL` is set
- WHEN the Gemini adapter is created
- THEN `LLM_BASE_URL` is not used in the API call

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

### Requirement: Gemini Free-Form Chat

When the Gemini adapter receives a request with no tool schemas (or tools array is empty), it MUST send messages to the Gemini `generateContent` API and return a `ProviderResponse` with `content` set to the assistant text and `toolCalls` undefined.

#### Scenario: Plain chat through Gemini

- GIVEN `LLM_PROVIDER` is `"gemini"` and messages contain `[{ role: "user", content: "Hello" }]`
- WHEN the adapter calls Gemini and receives a text-only response
- THEN `ProviderResponse.content` is the assistant text and `toolCalls` is undefined

#### Scenario: System prompt mapping

- GIVEN the adapter receives `systemPrompt: "You are a video editor"`
- WHEN it builds the Gemini request
- THEN the system prompt is mapped to Gemini's system instruction field, not as a user message

### Requirement: Gemini Tool Calling

When the Gemini adapter receives a request with tool schemas, it MUST convert internal `ToolSchema[]` to Gemini function declarations, call `generateContent` with declarations attached, and if Gemini returns function call parts, map each to a `ToolCall { id, name, args }` with a synthesized non-empty `id`.

#### Scenario: Gemini returns function calls

- GIVEN `transcribe_video` is in tool schemas and Gemini responds with a function call part `{ name: "transcribe_video", args: {} }`
- WHEN the adapter maps the response
- THEN `toolCalls` contains one `ToolCall` with `name: "transcribe_video"`, `args: {}`, and a synthesized `id`

#### Scenario: Gemini returns text despite tools

- GIVEN tool schemas are provided but Gemini responds with only text
- WHEN the adapter maps the response
- THEN `toolCalls` is undefined and `content` holds the text

#### Scenario: Tool schema type mapping

- GIVEN an internal tool schema has parameters `[{ key: "assetId", type: "string", required: true }]`
- WHEN the adapter converts to Gemini function declarations
- THEN the parameter appears in `FunctionDeclaration.parameters.properties` with type `"string"`
