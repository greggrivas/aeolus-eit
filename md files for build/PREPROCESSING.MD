# PREPROCESSING

## Scope

This preprocessing specification applies to:

- **Wind Farm A only**

Wind Farms B and C are out of scope for the current course deliverable and should not be treated as required implementation targets.

## Core Rule

Do not overwrite the paper’s labels.

We keep:

- the dataset-level `event_label`
- the timestamp-level `status_type_id`
- the `train_test` split

Preprocessing adds derived flags on top of those raw values.

## Main Derived Fields

For each row, store:

- `paper_is_normal`
- `usable_for_training`
- `is_implausible`
- `is_outlier_statistical`

Where:

- `paper_is_normal = status_type_id in {0, 2}`
- `usable_for_training = paper_is_normal AND passes_physical_plausibility AND not_excluded`

## Wind Farm A Assumptions

For the current scope:

- do not assume `0 == missing`
- preserve raw source values
- use plausibility checks rather than farm-B/C missing-like-zero logic

## Recommended Preprocessing Approach

### 1. Preserve the raw source

The CARE CSV files remain unchanged.

### 2. Standardize structure

- parse timestamps
- normalize numeric types
- preserve metadata columns

### 3. Join metadata

Join:

- `event_info.csv`
- `feature_description.csv`

### 4. Derive `paper_is_normal`

Use:

- normal status IDs: `{0, 2}`
- abnormal status IDs: `{1, 3, 4, 5}`

### 5. Add plausibility filter

For normal-behavior modeling, derive:

- `plausibly_normal_operation`

Use wind speed and power logic to identify rows that are unlikely to represent normal operation.

### 6. Feature filtering

Remove or isolate:

- constant columns
- near-constant columns
- clearly unusable columns
- ID/split/timestamp fields from model input features

### 7. Training/evaluation split rule

- train only on `train` rows
- evaluate only on `prediction` rows
- fit preprocessing statistics on training rows only

## Outlier Policy

### Raw dataset view

Never overwrite raw source data.

### Prediction/evaluation rows

Do not remove anomaly-like extremes from prediction rows.

### Training rows

Be stricter for normal-behavior model training.

Exclude or flag rows that are:

- non-normal by status
- physically implausible
- clearly corrupted
- extreme enough to be unsuitable for normal-behavior learning

## Artifact Outputs

The preprocessing stage should produce:

- cleaned event artifact
- preprocessing metadata
- audit report

The current course scope does not require complex multi-farm preprocessing branches.

## Explicitly Out of Scope

The following are not required in the current implementation:

- Wind Farm B missing-like-zero logic
- Wind Farm C missing-like-zero logic
- multi-farm preprocessing pipelines
- cross-farm harmonization

## Future Work

If the project is later extended to B/C, preprocessing must be expanded with:

- missing-like-zero handling
- farm-specific quality rules
- additional artifact logic

## Final Rule

The implemented preprocessing pipeline should stay:

- paper-consistent
- traceable
- single-farm
- good enough to support Wind Farm A event analysis and benchmark runs
