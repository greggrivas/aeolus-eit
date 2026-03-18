# Chat Integration Plan

  ## Purpose

This document defines how chat should be integrated into Aeolus.

The chat feature is included for demonstration purposes and is not required to be fully functional in
the first implementation milestone.

The current project scope is:

- Wind Farm A only

  ## Core Decision

  Aeolus will **not** use a local LLM.

  Instead, the app will be designed around a future integration with **OpenRouter** using an API key that
  will be added later.

  This means:

  - no local model hosting
  - no local inference pipeline
  - no GPU dependency for chat
  - no requirement for chat to work from the first build

  ## Product Role of Chat

  The assistant is a **supporting feature**, not the core of the application.

  Its job is to help users interpret:

  - event data
  - fault context
  - benchmark results
  - CARE score outputs
  - selected sensor behavior
  - comparisons between runs or events

  The assistant should provide:

  - plain-language summaries
  - contextual explanations
  - benchmark interpretation
  - navigation help inside the app

  The assistant should not:

  - invent data
  - provide fake calculations
  - act as the source of truth over backend outputs
  - block the app if it is unavailable

  ## Implementation Principle

  The application must be fully usable without a working chat provider.

  This is a strict requirement.

  The first build should support:

  - chat UI present in the interface
  - backend chat contract defined
  - disabled or fallback behavior when no API key is present
  - later activation by adding OpenRouter environment variables

  ## Architecture

  ### Chat provider model

  The only planned provider is:

  - **OpenRouter**

  The integration should be built so that:

  - frontend never calls OpenRouter directly
  - all LLM calls go through the backend
  - the backend constructs prompts using current app context
  - provider secrets remain server-side

  ### High-level flow

  1. User sends a message from the app chat panel
  2. Frontend sends the message and UI context to backend
  3. Backend builds a context-aware prompt
  4. If OpenRouter API key is configured:
     - backend sends request to OpenRouter
     - backend returns formatted assistant response
  5. If OpenRouter API key is missing:
     - backend returns fallback response
     - frontend still shows a working assistant panel state

  ## Initial Build Requirements

  The first implementation does **not** need real chat inference.

  It does need:

  - assistant panel layout
  - backend route for chat requests
  - request/response types
  - loading state
  - disabled state
  - missing-key fallback behavior

  ## Required Behavior When Chat Is Not Live

  If the OpenRouter API key is missing or chat is not yet activated:

  - the chat panel must still render
  - the app must not crash
  - the user must receive a clear response state

  Recommended fallback message behavior:

  - explain that the assistant is not connected yet
  - optionally echo the available app context
  - optionally suggest what the assistant will later help with

  Example fallback intent:

  - “Assistant is not connected yet. OpenRouter API configuration has not been added. You can still
  browse events, benchmark runs, and sensor views.”

## Backend Contract

### Recommended endpoint

  - `POST /assistant/query`

### Request payload

  The request should include:

  - `message`
  - `mode`
  - `selected_event_id`
  - `selected_run_id`
  - `visible_context`

### Meaning of fields

  - `message`: the user’s text input
  - `mode`: current app mode such as `operations` or `benchmark`
  - `selected_event_id`: currently selected event
  - `selected_run_id`: currently selected benchmark run
  - `visible_context`: optional structured context from the current page, such as metrics, labels, chart
  summaries, and filters

  ### Response payload

  The response should include:

  - `message`
  - `status`
  - `source`
  - `suggestions`

  ### Meaning of fields

  - `message`: assistant reply in plain language
  - `status`: `ok`, `disabled`, or `error`
  - `source`: `openrouter`, `fallback`, or `mock`
  - `suggestions`: optional follow-up prompts or actions

  ## Prompt Construction Rules

  When chat is enabled later, prompts should be built from actual app context.

  The backend should include things like:

  - selected event summary
  - event label
  - event description
  - current mode
  - current benchmark scores
  - feature description details
  - current visible chart/table context

  The prompt should explicitly instruct the model to:

  - use provided context only
  - avoid inventing values
  - explain uncertainty when needed
  - summarize results clearly
  - prioritize app-grounded interpretation over generic advice

  ## Frontend Requirements

  The UI should include:

  - collapsible assistant panel
  - input box
  - message history area
  - loading indicator
  - disabled state
  - error state

  The assistant should appear as part of the overall product structure, even before it is live.

  ## UI States To Support

  ### Enabled state
  Used later when OpenRouter is configured.

  ### Disabled state
  Used when no API key exists yet.

  ### Loading state
  Used while the backend is processing a chat request.

  ### Error state
  Used if OpenRouter request fails or backend returns an error.

  ## Development Recommendation

  During early implementation, the backend can return a mock or fallback response.

  This is preferred over trying to fully integrate OpenRouter immediately.

  Recommended order:

  1. build chat panel UI
  2. build backend request/response contract
  3. implement fallback response mode
  4. later add OpenRouter integration
  5. later refine prompts and context quality

  ## Configuration Plan

  Environment variables will be added later by the user.

  Expected variables:

  - `OPENROUTER_API_KEY`
  - optional model variable such as `OPENROUTER_MODEL`

  The app should behave correctly when they are missing.

  ## Final Decision Summary

  Aeolus chat will be implemented with these rules:

  - no local LLM
  - OpenRouter is the planned provider
  - chat is not required to work in the first build
  - UI and backend contract should exist from the start
  - the app must work fully without chat
  - missing API key must trigger a graceful fallback state
  - all LLM access must be server-side

## Grounding and Safety Rules

  With points like:

  - raw SCADA files are never passed directly to the LLM
  - the LLM only receives backend-approved structured context
  - anomaly detection, CARE scoring, and event classification are produced by backend logic or saved
    artifacts
  - the LLM may explain results, but may not generate authoritative decisions
  - if required context is missing, the assistant must say so instead of inferring


  The proper flow is:

  1. User asks a question
  2. Backend determines relevant app context
  3. Backend calls internal tools/functions
  4. Tools return structured JSON
  5. Backend builds a grounded prompt from that JSON
  6. LLM responds only using that provided context
  7. App shows the answer as an explanation, not as the source of truth


