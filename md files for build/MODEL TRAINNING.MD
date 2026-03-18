# Model Trainning

## Purpose

This document defines the model-training strategy for Aeolus.

The current course scope is explicitly limited to **Wind Farm A**.

This means all training, evaluation, benchmark artifacts, and presentation claims are about:

- Wind Farm A only

## Hardware Reality

Current available hardware:

- Lenovo ThinkPad
- 16 GB RAM
- no dedicated GPU

Practical conclusion:

- the project is feasible locally if we stay CPU-friendly
- baseline training is realistic
- heavy deep-learning experimentation should be deferred or optionally moved to Colab

## Scope Rule

The current project does **not** train on the entire CARE dataset.

The official modeling scope is:

- Wind Farm A only

This is a deliberate course-scoping decision, not a statement that the architecture cannot later be extended.

## Training Philosophy

### Primary modeling direction

The first model track should stay aligned with the CARE paper:

- normal-behavior modeling
- anomaly detection from deviation from normal behavior
- benchmark evaluation using CARE-style outputs

### Why this is the right first path

Wind Farm A still gives a meaningful early fault detection problem while remaining manageable.

The first model path should focus on:

- learning normal behavior from `train` rows
- generating anomaly scores on `prediction` rows
- converting those into event-level outputs
- benchmarking those outputs within Wind Farm A

## Preprocessing Constraints That Affect Training

Training must respect these rules:

- keep the paper labels unchanged
- keep `train_test` unchanged
- preserve raw source data
- add derived flags instead of overwriting values
- use a plausibility filter
- avoid blanket outlier removal
- never remove anomaly-like extremes from prediction/evaluation windows

### Training data rule

For normal-behavior models, training rows should be restricted to rows that are:

- in the `train` split
- normal according to the paper label logic
- plausible for normal operation
- not physically implausible
- not excessively corrupted by multi-feature outlier behavior

## Recommended Model Sequence

### Stage 1: pipeline validation baseline

The first implementation should use a simple CPU-friendly baseline.

Examples:

- simple statistical threshold baseline
- PCA reconstruction baseline

The purpose of this stage is:

- validate preprocessing
- validate artifact generation
- validate benchmark output structure
- validate backend and UI integration

### Stage 2: first stronger model

After the baseline path is stable, add the first more meaningful model for Wind Farm A.

Recommended next model:

- PCA reconstruction error or a small autoencoder

If the goal is to show a clearly trained model artifact rather than only a statistical detector, then:

- a small autoencoder is the most appropriate next step

### Stage 3: optional richer comparison

Only if time allows, compare additional Wind Farm A models such as:

- Isolation Forest
- One-Class SVM
- small autoencoder

## Local vs Colab

### What should stay local

Local machine should handle:

- parsing raw Wind Farm A files
- joining metadata
- feature filtering
- cleaned artifact generation
- baseline training
- benchmark export files

### What can move to Colab later

Only if needed:

- autoencoders
- repeated experiments
- longer runs

## Time Expectations

These are rough estimates for Wind Farm A scope:

- preprocessing pass: `30 minutes to 2 hours`
- baseline detector: `minutes to low hours`
- first stronger model: `hours`
- repeated experiments: `longer depending on model complexity`

## What The Project Trains Right Now

The current implementation already includes a **baseline statistical detector** for Wind Farm A.

That baseline is useful to validate:

- data flow
- benchmark artifacts
- API responses
- frontend rendering

It is not yet the final “real model” stage.

## Farm Scope Strategy

Aeolus is officially scoped to **Wind Farm A** for this course project.

### Why Wind Farm A

- fewer features
- simpler preprocessing
- faster path to a complete prototype
- easier to present

### Current modeling scope

The project should:

- train on Wind Farm A only
- benchmark on Wind Farm A only
- present results for Wind Farm A only

### Out of scope

The current project does not need:

- Wind Farm B models
- Wind Farm C models
- cross-farm comparison
- cross-farm generalization claims

### Future work

If the project is ever extended beyond the course scope, then B and C can be added later as separate extensions.

## Final Recommendation

For the course deliverable, the model strategy should be:

1. keep Wind Farm A only
2. keep baseline artifacts for pipeline validation
3. train one stronger Wind Farm A model next
4. benchmark that model within Wind Farm A
5. avoid multi-farm expansion unless time remains after the core prototype is presentation-ready
