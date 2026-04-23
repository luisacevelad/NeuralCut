# Delta for Editor Chat Panel

## MODIFIED Requirements

### Requirement: Message Display

The system SHALL render a scrollable `MessageList` displaying all messages in `chatStore.messages` in chronological order. Each message MUST show its role (`user`, `assistant`, or `tool_result`) and content. When a `tool_result` message contains a JSON-parseable transcript result (has `fullText` and `segments` keys), the system MUST render it as a transcript card showing the asset name, language, duration, full text, and timestamped segments formatted as `[MM:SS] text`. For all other messages, content MUST be rendered as plain text. The list MUST auto-scroll to the latest message when a new message arrives.

(Previously: All messages rendered as plain text with role labels only.)

#### Scenario: Messages render in order

- GIVEN `chatStore.messages` contains three messages: user, assistant, user
- WHEN the ChatPanel renders
- THEN all three messages appear in chronological order with correct role labels
- AND the list is scrolled to the bottom

#### Scenario: Empty state

- GIVEN `chatStore.messages` is empty
- WHEN the ChatPanel renders
- THEN a placeholder prompt is shown (e.g., "Ask something about your project")

#### Scenario: Transcript tool result renders as card

- GIVEN `chatStore.messages` contains a `tool_result` with content `JSON.stringify({ assetName: "clip.mp4", fullText: "Hello world", segments: [{ text: "Hello world", start: 0, end: 2.5 }], language: "en", duration: 30 })`
- WHEN the ChatPanel renders
- THEN the message renders as a transcript card showing "clip.mp4", "en", duration, full text, and `[00:00] Hello world`

#### Scenario: Non-transcript tool result renders as plain text

- GIVEN `chatStore.messages` contains a `tool_result` with content `JSON.stringify({ projectId: "p1", mediaCount: 2 })`
- WHEN the ChatPanel renders
- THEN the message renders as plain text (no transcript card)
