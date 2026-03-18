# API CONTRACT

## Purpose

This document defines the backend API contract for Aeolus.

The API may remain farm-aware internally, but the **documented prototype scope is Wind Farm A only**.

That means:

- sample responses should use Wind Farm A
- benchmark examples should use Wind Farm A
- the frontend should only depend on Wind Farm A support in the current course scope

## API Design Principles

### 1. Event-centric design

The API should be centered on:

- events
- event timeseries
- benchmark runs
- assistant context

### 2. Raw and derived data stay separate

The API should distinguish between:

- raw source data
- cleaned/model-ready values
- derived flags
- benchmark outputs

### 3. Stable IDs

The API should expose stable identifiers for:

- event
- asset/turbine
- benchmark run
- model result

## Scope Note

The current supported farm in the prototype is:

- `A`

The API can keep `farm_id` in its schemas for engineering convenience, but the course project should only document and present:

- Wind Farm A

## Core Types

### FarmSummary

```json
{
  "farm_id": "A",
  "farm_name": "Wind Farm A",
  "dataset_count": 22,
  "anomaly_event_count": 11,
  "normal_event_count": 11,
  "feature_count": 86,
  "sensor_count": 54,
  "asset_count": 5
}
```

### FeatureDescription

```json
{
  "farm_id": "A",
  "sensor_name": "sensor_0",
  "statistics_type": "average",
  "description": "Ambient temperature",
  "unit": "Celsius",
  "is_angle": false,
  "is_counter": false
}
```

### EventSummary

```json
{
  "event_id": "68",
  "farm_id": "A",
  "asset_id": "0",
  "event_label": "anomaly",
  "event_start": "2023-07-28 13:20:00",
  "event_end": "2023-08-11 13:10:00",
  "event_start_id": "1234",
  "event_end_id": "1456",
  "event_description": "Transformer failure"
}
```

### EventDetail

```json
{
  "event": {
    "event_id": "68",
    "farm_id": "A",
    "asset_id": "0",
    "event_label": "anomaly",
    "event_start": "2023-07-28 13:20:00",
    "event_end": "2023-08-11 13:10:00",
    "event_start_id": "1234",
    "event_end_id": "1456",
    "event_description": "Transformer failure"
  },
  "dataset": {
    "row_count": 58000,
    "feature_count": 86,
    "train_row_count": 52500,
    "prediction_row_count": 5500
  },
  "labels": {
    "paper_label": "anomaly",
    "normal_status_ids": [0, 2],
    "abnormal_status_ids": [1, 3, 4, 5]
  },
  "quality_flags": {
    "has_missing_like_zero_risk": false,
    "status_consistency_warning": false
  }
}
```

### EventTimeseriesResponse

```json
{
  "event_id": "68",
  "farm_id": "A",
  "features": ["sensor_0_avg", "sensor_1_avg", "sensor_2_avg"],
  "points": [
    {
      "time_stamp": "2023-07-28 13:20:00",
      "row_id": "1234",
      "asset_id": "0",
      "split": "prediction",
      "status_type_id": 0,
      "paper_is_normal": true,
      "usable_for_training": false,
      "selected_features": {
        "sensor_0_avg": 22.1,
        "sensor_1_avg": 301.4,
        "sensor_2_avg": 129.0
      },
      "derived_flags": {
        "is_missing_like": false,
        "is_implausible": false,
        "is_outlier_statistical": false
      }
    }
  ]
}
```

### BenchmarkRunSummary

```json
{
  "run_id": "run_2026_03_04_001",
  "name": "Wind Farm A baseline run",
  "created_at": "2026-03-04T12:00:00Z",
  "farm_ids": ["A"],
  "models": ["robust_threshold"],
  "status": "completed",
  "scoring_version": "care_v1",
  "leaderboard_size": 1
}
```

## Endpoints

### Health and bootstrap

- `GET /health`
- `GET /bootstrap`

### Dataset and metadata

- `GET /farms`
- `GET /farms/{farm_id}/summary`
- `GET /farms/{farm_id}/features`
- `GET /events`
- `GET /events/{event_id}`
- `GET /events/{event_id}/summary`
- `GET /events/{event_id}/timeseries`

### Benchmarking

- `GET /benchmark/runs`
- `GET /benchmark/runs/{run_id}`
- `GET /benchmark/runs/{run_id}/leaderboard`
- `GET /benchmark/runs/{run_id}/events/{event_id}`

### Assistant

- `GET /assistant/context/event/{event_id}`
- `GET /assistant/context/benchmark/{run_id}`
- `POST /assistant/query`

## Notes On Scope

### `GET /farms`

This endpoint may remain in the API even though the project is single-farm, because:

- it keeps the backend structure clean
- it does not harm the single-farm presentation

For the current prototype, the documented expected farm is:

- Wind Farm A

### `GET /events`

The frontend should use this to list Wind Farm A events only.

### Benchmarking

All benchmark examples and UI expectations should be treated as:

- Wind Farm A runs only

## Assistant Context Scope

Assistant requests should focus on:

- selected Wind Farm A event
- selected benchmark run
- visible metrics and charts

No multi-farm context is required in the current prototype.

## Final Rule

The API should remain simple and engineering-friendly, but all product-facing documentation and presentation should treat it as:

- a Wind Farm A API for the current course deliverable
