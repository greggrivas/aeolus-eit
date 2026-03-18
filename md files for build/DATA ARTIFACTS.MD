# DATA ARTIFACTS

## Purpose

This document defines the artifact strategy for Aeolus.

The current scope is:

- **Wind Farm A only**

Artifacts are the persistent outputs produced by:

- preprocessing
- model training
- benchmark evaluation
- backend integration

## Why Artifacts Exist

Artifacts are needed because the app should not recompute everything from raw CSVs every time it runs.

The raw CARE files remain the source truth.

Artifacts store:

- cleaned/model-ready data
- preprocessing metadata
- audit information
- model outputs
- benchmark outputs
- UI-ready summaries later

## Core Principle

Keep:

- raw CARE source files untouched
- derived outputs in a separate artifact layer

Do not duplicate raw data unnecessarily.

## Current Artifact Families

### Catalogs

Used for:

- event listing
- feature listing
- backend bootstrap

### Preprocessing artifacts

Used for:

- cleaned Wind Farm A event data
- preprocessing metadata
- preprocessing audits

### Training artifacts

Used for:

- saved baseline or future model outputs
- model metadata

### Benchmark artifacts

Used for:

- predictions
- event-level summaries
- leaderboard outputs
- run metadata

## Recommended Structure

```text
artifacts/
├── catalogs/
├── preprocessing/
├── training/
└── benchmark/
```

## Wind Farm A Scope

All required artifacts for the current course scope should be:

- Wind Farm A only

That means:

- no required B/C preprocessing artifacts
- no required B/C benchmark artifacts
- no required cross-farm summaries

## Minimum Required Artifacts

The project should retain:

- Wind Farm A event catalog
- Wind Farm A feature catalog
- cleaned Wind Farm A event artifacts
- preprocessing `meta.json`
- preprocessing `audit.json`
- baseline or model artifact
- benchmark `run.json`
- benchmark `leaderboard.json`
- event-level benchmark outputs

## Storage Guidance

Avoid large duplicated raw copies where possible.

The artifact layer should prioritize:

- traceability
- reusability
- compactness

The project can later improve storage efficiency further, but the current course requirement is simply to keep the artifact layer usable and scoped.

## Future Work

Later improvements may include:

- Parquet conversion
- lighter event summaries
- multi-farm artifact support
- assistant context artifacts

## Final Rule

The artifact layer should support the Wind Farm A prototype cleanly without turning the project into a multi-farm storage system.
