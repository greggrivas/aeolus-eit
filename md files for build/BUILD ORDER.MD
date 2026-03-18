# BUILD ORDER

## Purpose

This document defines the implementation order for Aeolus.

The project is intentionally scoped to **Wind Farm A only** so the course deliverable can become a complete single-farm prototype.

## Core Strategy

Aeolus should be built as a Wind Farm A vertical slice in this order:

1. data loading
2. preprocessing
3. one baseline detector
4. one benchmark result path
5. backend API
6. frontend shell
7. Operations screen usefulness
8. Benchmark Lab usefulness
9. assistant fallback

## Guiding Rule

The first milestone is not “support all farms”.

The first milestone is:

- one farm
- one working event workflow
- one baseline detector
- one benchmark artifact path
- one event view
- one benchmark view
- one disabled assistant panel

That is enough to validate the architecture and produce a presentation-ready prototype.

## Farm Scope Strategy

The official implementation target is:

- **Wind Farm A only**

### Why Farm A

- fewer features
- simpler preprocessing
- lower technical risk
- already aligned with the current code path

### Out of scope

The following are not part of the main build path:

- Wind Farm B support
- Wind Farm C support
- cross-farm comparison
- multi-farm benchmark views

They belong only in future work.

## Phase 0: Project Setup

### Goal

Create a clean project structure and establish where code and artifacts will live.

### Work

- define backend folder structure
- define frontend folder structure
- define artifact folder structure
- define environment variables
- define Python and Node tooling
- define run commands

### Deliverables

- backend app skeleton
- frontend app skeleton
- artifact directories
- env template
- run instructions

## Phase 1: Wind Farm A Data Catalog Foundation

### Goal

Make Wind Farm A queryable in a structured way before any training begins.

### Work

- load Wind Farm A event metadata from `event_info.csv`
- load Wind Farm A feature metadata from `feature_description.csv`
- generate normalized event catalog
- generate feature catalog

### Deliverables

- Wind Farm A event catalog artifact
- Wind Farm A feature catalog artifact
- one loader that can resolve:
  - event
  - source CSV
  - feature metadata

### Success criteria

- can list Wind Farm A events
- can resolve one Wind Farm A event to its CSV
- can read Wind Farm A feature descriptions correctly

## Phase 2: Wind Farm A Preprocessing

### Goal

Build the first full preprocessing path for Wind Farm A.

### Work

- parse one event CSV from Wind Farm A
- normalize column types
- parse timestamps
- preserve `event_label`, `status_type_id`, and `train_test`
- add:
  - `paper_is_normal`
  - `usable_for_training`
  - preprocessing flags
- join event and feature metadata
- produce:
  - cleaned event artifact
  - preprocessing metadata
  - audit report

### Deliverables

- one event preprocessing pipeline
- one farm-level preprocessing path for Wind Farm A
- reusable preprocessing artifact format

### Success criteria

- one Wind Farm A event can be transformed into cleaned outputs
- preprocessing does not overwrite raw labels
- audit output explains what happened to the data

## Phase 3: Wind Farm A Baseline Detector

### Goal

Prove the training pipeline using a simple baseline on Wind Farm A.

### Recommended first model

Start with:

- simple statistical threshold baseline or PCA reconstruction

### Work

- train only on Wind Farm A training rows
- use normal-behavior training data only
- generate anomaly scores on prediction rows
- threshold anomaly scores
- save timestamp-level predictions
- save event-level result summaries

### Deliverables

- baseline detector artifact
- prediction artifact
- event-level summary

### Success criteria

- one detector trains end to end
- one event receives anomaly scores
- one event receives a thresholded anomaly result
- outputs are saved as artifacts

## Phase 4: Wind Farm A Benchmark Output

### Goal

Create the first benchmark artifact path for Wind Farm A.

### Work

- implement score output structure
- compute model score breakdown
- compute event-level summary
- create run metadata
- create leaderboard artifact

### Deliverables

- run artifact
- leaderboard artifact
- event-level benchmark artifact
- score breakdown structure

### Success criteria

- one benchmark run exists
- one leaderboard can be read
- one event-level result can be inspected

## Phase 5: Backend API

### Goal

Expose the Wind Farm A application contract from FastAPI.

### First endpoints to implement

- `GET /health`
- `GET /bootstrap`
- `GET /events`
- `GET /events/{event_id}`
- `GET /events/{event_id}/summary`
- `GET /events/{event_id}/timeseries`
- `GET /benchmark/runs`
- `GET /benchmark/runs/{run_id}`
- `GET /benchmark/runs/{run_id}/leaderboard`

The backend may remain farm-aware internally, but the documented prototype scope is Wind Farm A only.

### Success criteria

- frontend can fetch Wind Farm A event list
- frontend can fetch one event detail
- frontend can fetch one benchmark leaderboard

## Phase 6: Frontend Shell

### Goal

Build the first usable app shell against the real backend.

### Work

- create layout shell
- create header
- create left sidebar
- create mode switch
- create assistant panel shell
- create loading/error states
- create navigation between:
  - Overview
  - Operations
  - Benchmark Lab
  - Dataset Explorer

### Success criteria

- app loads
- app can switch between modes
- sidebar renders Wind Farm A event context
- assistant panel can open/close even if disabled

## Phase 7: Operations Screen Usefulness

### Goal

Make the Operations view actually useful for one selected Wind Farm A event.

### Work

- event selection
- event detail header
- event metadata cards
- time-series chart region
- train vs prediction indicator
- quality notes panel
- anomaly overlay later

### Success criteria

- selecting an event updates the page
- event metadata renders correctly
- at least one chart shows real data
- the page is useful without chat

## Phase 8: Benchmark Lab Usefulness

### Goal

Make the Benchmark Lab useful for Wind Farm A runs.

### Work

- run selector
- leaderboard table
- score cards
- event-level benchmark detail panel
- notes explaining placeholder vs full CARE logic

### Success criteria

- one run can be loaded
- one leaderboard can be displayed
- one event-level benchmark result can be inspected

## Phase 9: Assistant Fallback Integration

### Goal

Add the assistant shell and backend contract without requiring live OpenRouter integration.

### Work

- implement `POST /assistant/query`
- implement fallback response behavior
- send selected page context to backend
- render message history
- render disabled/loading/error states

### Success criteria

- assistant works without OpenRouter key
- backend returns safe fallback messages
- app remains fully usable without live chat

## Definition Of First Meaningful Milestone

The first milestone is complete when:

- one Wind Farm A event can be loaded from raw data
- preprocessing artifacts exist for it
- one baseline detector can score it
- one benchmark run artifact exists
- FastAPI can serve the event and benchmark data
- the frontend can display one event detail page
- the frontend can display one leaderboard page
- the assistant panel exists in fallback mode

## Future Work

Only after the core single-farm prototype is solid:

- Wind Farm B preprocessing
- Wind Farm C preprocessing
- cross-farm comparison
- stronger model families
- richer assistant integration
