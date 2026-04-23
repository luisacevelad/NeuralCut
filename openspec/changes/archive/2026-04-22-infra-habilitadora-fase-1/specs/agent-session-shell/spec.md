# Agent Session Shell Specification

## Purpose

Defines the client-side orchestration boundary between the UI layer, the API proxy, Zustand stores, and the tool registry. This shell wires the full request/response cycle for one mock end-to-end interaction without real LLM or streaming.

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

The system SHALL expose `POST /api/agent/chat` that accepts `{ messages: ChatMessage[], context?: AgentContext }` and returns `{ content: string, toolCalls?: ToolCall[] }`. In this phase, the route MUST return a canned mock response — no real LLM call. The route MUST validate the request body schema and return 400 on invalid input.

#### Scenario: Valid request returns mock response

- GIVEN a POST request with valid `{ messages: [{ role: "user", content: "Hi" }] }`
- WHEN the handler processes the request
- THEN it returns 200 with `{ content: "...", toolCalls: [] }`

#### Scenario: Invalid request returns 400

- GIVEN a POST request with `{}` (missing `messages`)
- WHEN the handler processes the request
- THEN it returns 400 with an error description

### Requirement: Orchestrator Shell

The system SHALL provide a client-side `orchestrator.run(messages, context)` function that: (1) sets `agentStore.status` to `"calling"`, (2) calls the API proxy, (3) if the response contains `toolCalls`, resolves each via the tool registry, (4) appends the assistant response to `chatStore`, (5) sets status to `"idle"`. On error at any step, the orchestrator MUST set `chatStore.error` and `agentStore.status` to `"error"`.

#### Scenario: Happy path with no tool calls

- GIVEN `chatStore` has one user message and the API returns `{ content: "Hello!", toolCalls: [] }`
- WHEN `orchestrator.run()` is invoked
- THEN `chatStore.messages` contains the assistant reply "Hello!"
- AND `agentStore.status` is `"idle"`

#### Scenario: Tool call resolution

- GIVEN the API returns `{ content: "", toolCalls: [{ name: "echo_context", args: {} }] }`
- AND `echo_context` is registered in the tool registry
- WHEN the orchestrator resolves tool calls
- THEN the tool executes and its result is appended to `chatStore.messages`
- AND `agentStore.status` is `"idle"`

### Requirement: Tool Registry Shell

The system SHALL provide a `ToolRegistry` extending `DefinitionRegistry<string, ToolDefinition>` where `ToolDefinition` contains `{ name, description, parameters, execute: (args, context) => Promise<unknown> }`. In this phase exactly ONE tool — `echo_context` — MUST be registered. The registry MUST support `register`, `get`, `has`, and `getAll`.

#### Scenario: Mock echo tool executes

- GIVEN `echo_context` is registered with `execute: (args, ctx) => ({ projectId: ctx.projectId, ... })`
- WHEN `registry.get("echo_context").execute({}, context)` is called
- THEN it returns a context summary with projectId and mediaCount

### Requirement: Shared Foundational Types

The system SHALL define types in `apps/web/src/agent/types.ts`: `ChatMessage { id, role, content, toolCalls?, timestamp }`, `ToolCall { id, name, args }`, `ToolResult { toolCallId, name, result, error? }`, `ExecutionState = "idle" | "sending" | "processing" | "responding" | "error"`, `AgentContext { projectId, activeSceneId, mediaAssets, playbackTimeMs }`, `ToolDefinition { name, description, parameters, execute }`. These types MUST be the single source of truth shared across stores, orchestrator, registry, and API route.

#### Scenario: Types are importable everywhere

- GIVEN `types.ts` exports `ChatMessage`, `ToolCall`, `ToolResult`, `ExecutionState`, `AgentContext`, `ToolDefinition`
- WHEN any module in `agent/`, `stores/`, or `app/api/agent/` imports from it
- THEN TypeScript compiles without errors
