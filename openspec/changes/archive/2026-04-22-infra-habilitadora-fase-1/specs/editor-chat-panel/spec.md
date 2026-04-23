# Editor Chat Panel Specification

## Purpose

Defines the chat panel embedded in the editor's right panel slot, sharing space with Properties via a tab toggle. This panel is the sole UI surface through which the user interacts with the conversational agent.

## Requirements

### Requirement: Tabbed Panel Placement

The system SHALL render a tabbed right panel with "Properties" and "Chat" tabs. Selecting "Chat" MUST display the `ChatPanel`; selecting "Properties" MUST restore the existing properties view. The active tab MUST persist across re-renders within the session. The panel MUST NOT alter the existing 4-panel `ResizablePanelGroup` layout — it replaces only the content of the right panel slot.

#### Scenario: User switches to Chat tab

- GIVEN the editor is loaded and the right panel shows Properties
- WHEN the user clicks the "Chat" tab
- THEN the ChatPanel replaces the Properties content
- AND the `PanelSizes` configuration remains unchanged

#### Scenario: Default state on editor load

- GIVEN the editor loads for the first time
- THEN the right panel defaults to the "Properties" tab
- AND the Chat tab is available but not active

### Requirement: Message Display

The system SHALL render a scrollable `MessageList` displaying all messages in `chatStore.messages` in chronological order. Each message MUST show its role (`user` or `assistant`) and content. The list MUST auto-scroll to the latest message when a new message arrives.

#### Scenario: Messages render in order

- GIVEN `chatStore.messages` contains three messages: user, assistant, user
- WHEN the ChatPanel renders
- THEN all three messages appear in chronological order with correct role labels
- AND the list is scrolled to the bottom

#### Scenario: Empty state

- GIVEN `chatStore.messages` is empty
- WHEN the ChatPanel renders
- THEN a placeholder prompt is shown (e.g., "Ask something about your project")

### Requirement: Message Input and Submission

The system SHALL provide a text `InputArea` with a send button. Pressing Enter or clicking Send MUST append a new `user` message to `chatStore`, set `chatStore.loading` to `true`, and trigger the agent flow. The input MUST be cleared after submission. The input and send button MUST be disabled while `chatStore.loading` is `true`.

#### Scenario: User sends a message

- GIVEN the input contains "Describe the current scene"
- WHEN the user presses Enter
- THEN a new `user` message is appended to `chatStore.messages`
- AND `chatStore.loading` becomes `true`
- AND the input is cleared

#### Scenario: Input disabled during loading

- GIVEN `chatStore.loading` is `true`
- WHEN the ChatPanel renders
- THEN the text input and send button are both disabled

### Requirement: Loading and Error States

The system SHALL display a loading indicator while awaiting the agent's response. If `chatStore.error` is non-null, the system MUST render an error banner with the error message and a retry affordance.

#### Scenario: Loading indicator shown

- GIVEN `chatStore.loading` is `true`
- WHEN the ChatPanel renders
- THEN a loading indicator is visible below the last message

#### Scenario: Error displayed with retry

- GIVEN `chatStore.error` equals "Network error"
- WHEN the ChatPanel renders
- THEN an error banner shows "Network error"
- AND a retry button is available
