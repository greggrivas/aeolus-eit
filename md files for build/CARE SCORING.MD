# CARE SCORING

## Purpose

This document defines how Aeolus should represent, compute, store, and display benchmark evaluation based on the CARE framework.

The current project scope is:

- **Wind Farm A only**

CARE scoring in the current course deliverable should therefore be understood as:

- model evaluation within Wind Farm A

## What CARE Measures

CARE is a model-evaluation score.

It measures the quality of an anomaly-detection model, not the probability of failure itself.

The main dimensions are:

- Coverage
- Accuracy
- Reliability
- Earliness

The final CARE score indicates how well a model:

- detects anomaly events
- recognizes normal behavior
- avoids false alarms
- detects anomalies early enough to be useful

## Scope Rule

For the current project:

- benchmark runs are Wind Farm A runs
- event-level evaluation is Wind Farm A event evaluation
- there is no required cross-farm benchmark comparison

## Alignment Rule

Aeolus should stay aligned with the CARE paper wherever practical.

This means:

- preserving the train/prediction split
- preserving event labels
- preserving timestamp-level status semantics
- excluding abnormal-status timestamps where the paper does so
- using event-aware scoring rather than only pointwise classification

## Score Components

### Coverage

Measures whether anomaly events are detected.

### Accuracy

Measures whether normal behavior is correctly recognized.

### Reliability

Measures event-level detection quality.

### Earliness

Measures how early anomaly behavior is detected within the event window.

### CARE Total

The overall benchmark score.

## Inputs To Scoring

Each run should use:

- model outputs
- prediction timestamps
- event labels
- status labels
- event start and end metadata
- thresholding configuration
- event aggregation logic

## Labeling Inputs

### Dataset-level labels

- `event_label`
- values: `anomaly` or `normal`

### Timestamp-level labels

- `status_type_id`

### Normal status mapping

- normal: `{0, 2}`
- abnormal: `{1, 3, 4, 5}`

## Prediction Representation

Each model should produce:

- `time_stamp`
- `event_id`
- `farm_id`
- `split`
- `anomaly_score`
- `anomaly_flag`
- `threshold_used`
- optional event-aggregation fields

For the current prototype, `farm_id` should be:

- `A`

## Event-Level Aggregation

CARE is not purely pointwise.

Aeolus should store event-level results such as:

- `event_prediction`
- `criticality_peak`
- `first_detection_timestamp`
- event-level score breakdown

## Important Current-State Note

The current implemented benchmark layer may still use placeholder scoring logic while the architecture is being validated.

That is acceptable as long as it is described honestly.

The goal is to replace placeholder logic with a proper CARE-paper implementation within the single-farm benchmark scope.

## Score Output Schema

Each model scorecard should include:

- model ID
- model name
- run ID
- Wind Farm A scope
- score breakdown
- notes about implementation status

## Run Metadata

Each benchmark run should store:

- `run_id`
- `name`
- `created_at`
- `farm_ids`
- `model_ids`
- `status`
- `scoring_version`
- `threshold_policy`
- `preprocessing_version`
- `dataset_version`

For the current prototype:

- `farm_ids = ["A"]`

## UI Requirements

The frontend should be able to display:

- CARE total
- four sub-scores
- event-level score detail
- notes about current scoring logic

The frontend does **not** need cross-farm benchmark views in the current scope.

## Assistant Requirements

The assistant may explain:

- already computed benchmark outputs
- event-level benchmark summaries
- score breakdowns

The assistant must never compute CARE on its own.

## Explicitly Out of Scope

The current course project does not require:

- Wind Farm B benchmark runs
- Wind Farm C benchmark runs
- cross-farm model comparison
- claims of cross-farm generalization

## Future Work

Future extensions may add:

- B/C benchmark support
- cross-farm comparison
- richer CARE variants

## Final Rule

CARE scoring in Aeolus should currently be understood as:

- a Wind Farm A benchmark evaluation layer for comparing models within a single-farm prototype
