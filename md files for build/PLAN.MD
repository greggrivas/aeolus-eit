# Aeolus Project Plan

## Summary

Aeolus is a local-first **Wind Farm A** fault detection and benchmark analysis prototype built on the CARE dataset.

The project is intentionally scoped to a **single farm** so that the course deliverable can be completed as a coherent end-to-end system instead of an unfinished multi-farm platform.

The application combines:

- an Operations mode for event-centric review of Wind Farm A datasets
- a Benchmark Lab mode for comparing model runs within Wind Farm A
- a FastAPI backend
- a custom Next.js frontend
- artifact-driven preprocessing, training, and benchmark outputs
- an optional OpenRouter-powered assistant for interpretation later

## Official Scope

The implemented and presented scope of the course project is:

- **Wind Farm A only**
- event analysis for Wind Farm A datasets
- model training and benchmark evaluation for Wind Farm A
- a single-farm web application built around those outputs

The following are **out of scope** for the current course deliverable:

- Wind Farm B support
- Wind Farm C support
- cross-farm comparison
- claims of cross-farm generalization

Wind Farms B and C may be mentioned only as **future work**.

## Why Wind Farm A

Wind Farm A is the recommended implementation target because:

- it has fewer features than Wind Farms B and C
- preprocessing is simpler
- it avoids the main missing-as-zero complication documented for B/C
- it gives the fastest path to a complete prototype

## Product Direction

Aeolus is a hybrid application with two explicit modes:

### Operations Mode

Focused on:

- browsing Wind Farm A events
- opening an event detail page
- viewing anomaly vs normal labels from the dataset metadata
- inspecting time-series behavior
- reviewing preprocessing and quality notes
- interpreting model outputs in an event-centric workflow

### Benchmark Lab Mode

Focused on:

- loading benchmark runs for Wind Farm A
- comparing models within Wind Farm A
- viewing CARE sub-scores and total score
- inspecting event-level detection quality
- supporting presentation and analysis of model performance

## Source Material

This project is grounded in:

- `CARE_To_Compare/`
- `paper from data.pdf`
- `other project inspiration/`
- `/home/greg/Documents/Projects/Digital_Twins-Boatface`

## Dataset Context

The CARE dataset as a whole contains:

- 95 datasets
- 44 anomaly events
- 51 normal events
- 3 wind farms
- 36 turbines

For this project, only **Wind Farm A** is in scope.

Wind Farm A includes:

- 22 event datasets
- anomaly and normal examples
- 10-minute SCADA rows
- `train_test` per row
- `status_type_id` per row
- event metadata in `event_info.csv`
- feature metadata in `feature_description.csv`

## Key Project Decisions

### Architecture

- The app is local-first.
- The backend is FastAPI.
- The frontend is a custom Next.js application.
- Grafana is not part of the product interface.
- The app is event-centric, not snapshot-centric.

### Data and preprocessing

- Raw CARE files must never be overwritten.
- `event_label`, `status_type_id`, and `train_test` remain unchanged from the dataset.
- Preprocessing adds derived flags instead of rewriting labels.
- The implemented preprocessing scope is Wind Farm A only.
- Raw anomaly-like extremes must not be removed from prediction/evaluation windows.

### Modeling and benchmarking

- The first real modeling scope is Wind Farm A only.
- The first implementation should use CPU-friendly baselines.
- Benchmark outputs are evaluated within Wind Farm A.
- The app consumes stored benchmark artifacts rather than retraining interactively.

### Assistant

- The assistant will use OpenRouter later.
- The assistant is optional and non-blocking in the first implementation milestone.
- The assistant is an interpretation layer, not a decision-making component.
- The assistant must never read raw SCADA files directly.
- The assistant must only receive backend-approved structured context and tool outputs.

## Document Map

This top-level plan is supported by:

- `PREPROCESSING.MD`
- `MODEL TRAINNING.MD`
- `LLM CHAT.MD`
- `API CONTRACT.MD`
- `INTERFACE.MD`
- `CARE SCORING.MD`
- `DATA ARTIFACTS.MD`
- `BUILD ORDER.MD`

## User Workflows

### Operations Mode

The Operations mode must support:

- browsing Wind Farm A events
- opening an event detail page
- viewing event metadata and labels
- inspecting time-series behavior
- reviewing status distribution
- reviewing preprocessing and quality notes
- viewing model-generated event interpretation where available

### Benchmark Lab

The Benchmark Lab must support:

- loading Wind Farm A benchmark runs
- comparing models on CARE sub-scores and total score
- reviewing event-level detection quality
- reviewing false alarms and normal-behavior performance
- opening event-level benchmark detail

### Assistant

The assistant should support:

- explaining event summaries
- explaining benchmark outputs
- answering questions about visible UI context
- summarizing backend-provided model outputs

The assistant must not invent data or act as the source of truth.

## Information Architecture

The application shell should contain:

- a persistent header
- a left sidebar
- a main workspace area
- an optional right assistant panel

### Top-level sections

- Overview
- Operations
- Benchmark Lab
- Dataset Explorer

### Core screens

- Overview screen
- Operations screen
- Event detail screen
- Benchmark Lab screen
- Benchmark run detail screen
- Dataset Explorer screen

All of these screens are scoped to **Wind Farm A**.

## Technical Architecture

The planned technical architecture is:

- Frontend: Next.js + TypeScript
- Backend: FastAPI + Python
- Data/model/scoring storage: local artifact files
- Frontend/backend integration: API-driven
- Chat provider: OpenRouter later
- No local LLM

## Public API Direction

The API remains event-centric and artifact-friendly.

The documented API may remain farm-aware internally for engineering convenience, but the current prototype scope is:

- active supported farm: `A`
- active benchmark scope: Wind Farm A only

## Preprocessing Summary

The preprocessing strategy is defined in `PREPROCESSING.MD`.

The top-level rules are:

- preserve raw labels and source files exactly
- add derived flags instead of overwriting values
- use `paper_is_normal`
- use `usable_for_training`
- apply a plausibility filter
- distinguish missing-like values, implausible values, and outlier-like signals
- preserve raw source data while producing cleaned/model-ready artifacts

## Modeling Summary

The modeling strategy is defined in `MODEL TRAINNING.MD`.

The top-level model plan is:

- single-farm modeling on Wind Farm A
- baseline-first implementation
- stronger model later after the pipeline is validated
- benchmark outputs stored as reusable artifacts

## CARE Scoring Summary

CARE scoring is a first-class benchmark object in Aeolus.

The app must represent and display:

- Coverage
- Accuracy
- Reliability
- Earliness
- CARE total
- event-level interpretation

The benchmark scope is **Wind Farm A only**.

## Artifact Strategy Summary

Aeolus is an artifact-driven system.

The project persists:

- dataset catalogs
- preprocessing artifacts and audits
- model artifacts
- benchmark prediction artifacts
- leaderboard summaries
- assistant context artifacts later

## Interface Summary

The interface is custom and single-farm.

It should support:

- Wind Farm A event analysis
- Wind Farm A benchmark comparison
- dataset exploration for Wind Farm A
- a collapsible assistant panel
- useful functionality even when chat is disabled

## Implementation Strategy

The build should follow a thin vertical slice:

1. Wind Farm A data catalogs
2. Wind Farm A preprocessing
3. Wind Farm A baseline model
4. Wind Farm A benchmark artifacts
5. Wind Farm A backend endpoints
6. Wind Farm A frontend
7. assistant fallback

## First Working Slice

The first meaningful implementation milestone is complete when:

- Wind Farm A can be loaded end to end
- one Wind Farm A event can be inspected through the API
- one preprocessing path produces reusable artifacts
- one baseline model produces anomaly scores for Wind Farm A
- one benchmark run produces Wind Farm A benchmark outputs
- the frontend can show event detail and benchmark summary
- the assistant panel exists in disabled/fallback mode

## Future Work

Possible future extensions after the course project:

- Wind Farm B preprocessing and modeling
- Wind Farm C preprocessing and modeling
- cross-farm comparisons
- stronger model families
- full OpenRouter integration
