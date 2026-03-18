#!/usr/bin/env python3
"""
03_score.py — Generate predictions for every event and compute CARE metrics.
Saves: updated event parquets (with anomaly_score, pred_anomaly columns),
       data/processed/scores_summary.parquet,
       data/processed/overall_care.json
"""
from __future__ import annotations

import json
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore", category=UserWarning, message="X has feature names")

# ── Paths ──────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "processed"
MODELS_DIR = ROOT / "models"

# ── Load artifacts ─────────────────────────────────────────────────────────────
model = joblib.load(MODELS_DIR / "isolation_forest.joblib")
scaler = joblib.load(MODELS_DIR / "scaler.joblib")
with open(MODELS_DIR / "model_metadata.json") as f:
    metadata = json.load(f)

feature_cols = metadata["feature_cols"]
threshold = metadata["threshold"]
print(f"Loaded model | threshold={threshold:.6f} | features={len(feature_cols)}")

# ── Step 1: Score every event ──────────────────────────────────────────────────
event_parquets = sorted(DATA_DIR.glob("event_*.parquet"))
print(f"Scoring {len(event_parquets)} events...")

for parquet_path in event_parquets:
    df = pd.read_parquet(parquet_path)

    # Only score prediction rows
    pred_mask = df["train_test"] == "prediction"
    if not pred_mask.any():
        df["anomaly_score"] = np.nan
        df["pred_anomaly"] = 0
        df.to_parquet(parquet_path, index=False)
        continue

    # Prepare features for prediction rows
    X = df.loc[pred_mask, feature_cols].copy()
    # Handle missing cols (fill with 0) and NaN (fill with median)
    for col in feature_cols:
        if col not in X.columns:
            X[col] = 0.0
    X = X[feature_cols].fillna(X[feature_cols].median())

    X_scaled = scaler.transform(X)
    scores = model.score_samples(X_scaled)  # higher = more normal

    df["anomaly_score"] = np.nan
    df["pred_anomaly"] = 0
    df.loc[pred_mask, "anomaly_score"] = scores
    df.loc[pred_mask, "pred_anomaly"] = (scores < threshold).astype(int)

    df.to_parquet(parquet_path, index=False)
    n_pred = pred_mask.sum()
    n_anom = int((df.loc[pred_mask, "pred_anomaly"] == 1).sum())
    print(f"  {parquet_path.name}: {n_pred} pred rows, {n_anom} predicted anomalies")

# ── Step 2: CARE metrics ───────────────────────────────────────────────────────
# Load catalog to know event labels
catalog = pd.read_parquet(DATA_DIR / "events_catalog.parquet")

# Load all events with prediction rows only
events = {}
for parquet_path in event_parquets:
    df = pd.read_parquet(parquet_path)
    event_id_str = parquet_path.stem.replace("event_", "")
    # Only keep prediction rows
    pred_df = df[df["train_test"] == "prediction"].copy()
    if len(pred_df) > 0:
        events[event_id_str] = pred_df

# ── Coverage (F2) — anomaly events only ───────────────────────────────────────
def compute_coverage(pred_df: pd.DataFrame) -> float | None:
    """F2 score for anomaly events. Filters to status NOT IN {1,3,4,5}."""
    # Filter to rows where status is 0 or 2 (normal status rows within anomaly event)
    # Actually: filter OUT maintenance/curtailment rows
    exclude_statuses = {1, 3, 4, 5}
    filtered = pred_df[~pred_df["status_type_id"].isin(exclude_statuses)]
    if len(filtered) == 0:
        return None

    # Ground truth: these are anomaly event prediction rows → label = 1
    y_true = np.ones(len(filtered), dtype=int)
    y_pred = filtered["pred_anomaly"].values.astype(int)

    tp = int(((y_true == 1) & (y_pred == 1)).sum())
    fp = int(((y_true == 0) & (y_pred == 1)).sum())
    fn = int(((y_true == 1) & (y_pred == 0)).sum())

    # F2: beta=2, so (1+4)*tp / ((1+4)*tp + 4*fn + fp)
    denom = 5 * tp + 4 * fn + fp
    if denom == 0:
        return 0.0
    return (5 * tp) / denom


def compute_accuracy_contribution(pred_df: pd.DataFrame) -> tuple[int, int]:
    """Return (tn, total_normal) for normal events."""
    # All rows in a normal event prediction window are truly normal
    tn = int((pred_df["pred_anomaly"] == 0).sum())
    fp = int((pred_df["pred_anomaly"] == 1).sum())
    return tn, tn + fp


def compute_reliability(pred_df: pd.DataFrame) -> float | None:
    """
    Reliability: criticality counter per event (increments on true anomaly rows,
    decrements on true normal rows). Alarm = criticality >= 72.

    For anomaly events, status_type_id == 0 means "currently running normally"
    within the event window (pre-fault period). The criticality counter tracks
    consecutive anomaly detections.
    """
    criticality = 0
    alarm_triggered = False

    for _, row in pred_df.iterrows():
        pred = int(row["pred_anomaly"])
        status = int(row["status_type_id"])

        if pred == 1 and status == 0:
            criticality += 1
        elif pred == 0 and status == 0:
            criticality = max(0, criticality - 1)  # gradual reset

        if criticality >= 72:
            alarm_triggered = True
            break

    return alarm_triggered


def compute_earliness(pred_df: pd.DataFrame) -> float | None:
    """
    Earliness weight for anomaly event: based on position of first detection.
    Returns None if no detections.
    """
    pred_df = pred_df.reset_index(drop=True)
    n = len(pred_df)
    if n == 0:
        return None

    detected_idxs = pred_df.index[pred_df["pred_anomaly"] == 1].tolist()
    if not detected_idxs:
        return None

    first_idx = detected_idxs[0]
    half_n = n / 2

    if first_idx <= half_n:
        weight = 1.0
    else:
        weight = max(0.0, 1.0 - 2 * (first_idx - half_n) / n)

    return weight


# ── Compute per-event scores ───────────────────────────────────────────────────
score_rows = []
total_tn = 0
total_normal_pred = 0

anomaly_event_labels = []     # ground truth: 1=anomaly triggered alarm
reliability_alarm_preds = []  # predicted: 1=alarm triggered

coverage_values = []
earliness_values = []

for _, cat_row in catalog.iterrows():
    event_id_str = str(cat_row["event_id"])
    label = cat_row["event_label"]

    pred_df = events.get(event_id_str)
    if pred_df is None or len(pred_df) == 0:
        score_rows.append({
            "event_id": cat_row["event_id"],
            "event_label": label,
            "coverage": None,
            "reliability_alarm": None,
            "earliness_weight": None,
            "has_detection": False,
        })
        continue

    coverage = None
    reliability_alarm = None
    earliness_weight = None

    if label == "anomaly":
        coverage = compute_coverage(pred_df)
        coverage_values.append(coverage if coverage is not None else 0.0)

        reliability_alarm = compute_reliability(pred_df)
        anomaly_event_labels.append(1)
        reliability_alarm_preds.append(1 if reliability_alarm else 0)

        earliness_weight = compute_earliness(pred_df)
        if earliness_weight is not None:
            earliness_values.append(earliness_weight)

    elif label == "normal":
        tn, total = compute_accuracy_contribution(pred_df)
        total_tn += tn
        total_normal_pred += total

        # For reliability: normal events should NOT trigger alarm
        reliability_alarm = compute_reliability(pred_df)
        anomaly_event_labels.append(0)
        reliability_alarm_preds.append(1 if reliability_alarm else 0)

    score_rows.append({
        "event_id": cat_row["event_id"],
        "event_label": label,
        "coverage": float(coverage) if coverage is not None else None,
        "reliability_alarm": bool(reliability_alarm) if reliability_alarm is not None else None,
        "earliness_weight": float(earliness_weight) if earliness_weight is not None else None,
        "has_detection": bool(pred_df["pred_anomaly"].any()) if pred_df is not None else False,
    })

# ── Aggregate CARE metrics ─────────────────────────────────────────────────────
# Coverage: mean F2 across anomaly events
coverage_score = float(np.mean(coverage_values)) if coverage_values else 0.0

# Accuracy: global TN rate across all normal event prediction rows
accuracy_score = (total_tn / total_normal_pred) if total_normal_pred > 0 else 0.0

# Reliability: F2 of alarm triggers vs event labels
if len(anomaly_event_labels) > 0:
    y_true_rel = np.array(anomaly_event_labels)
    y_pred_rel = np.array(reliability_alarm_preds)
    tp_r = int(((y_true_rel == 1) & (y_pred_rel == 1)).sum())
    fp_r = int(((y_true_rel == 0) & (y_pred_rel == 1)).sum())
    fn_r = int(((y_true_rel == 1) & (y_pred_rel == 0)).sum())
    denom_r = 5 * tp_r + 4 * fn_r + fp_r
    reliability_score = float((5 * tp_r) / denom_r) if denom_r > 0 else 0.0
else:
    reliability_score = 0.0

# Earliness: mean weight across anomaly events with detections
earliness_score = float(np.mean(earliness_values)) if earliness_values else 0.0

# Final CARE score
# CARE = (1*Coverage + 2*Earliness + 1*Reliability + 2*Accuracy) / 7
care_raw = (1 * coverage_score + 2 * earliness_score + 1 * reliability_score + 2 * accuracy_score) / 7

# Special rule: CARE = 0 if no anomalies detected OR Accuracy < 0.5
anomaly_events_detected = any(r["has_detection"] for r in score_rows if r["event_label"] == "anomaly")
if not anomaly_events_detected or accuracy_score < 0.5:
    care_score = 0.0
    care_zero_reason = "no_detections" if not anomaly_events_detected else "accuracy_below_0.5"
else:
    care_score = care_raw
    care_zero_reason = None

# ── Save results ───────────────────────────────────────────────────────────────
scores_df = pd.DataFrame(score_rows)
scores_df.to_parquet(DATA_DIR / "scores_summary.parquet", index=False)
print(f"\nSaved scores_summary.parquet ({len(scores_df)} rows)")

overall = {
    "coverage": round(coverage_score, 4),
    "accuracy": round(accuracy_score, 4),
    "reliability": round(reliability_score, 4),
    "earliness": round(earliness_score, 4),
    "care": round(care_score, 4),
    "care_zero_reason": care_zero_reason,
    "total_normal_prediction_rows": int(total_normal_pred),
    "total_tn": int(total_tn),
    "anomaly_events_with_detection": int(sum(1 for r in score_rows if r["event_label"] == "anomaly" and r["has_detection"])),
    "anomaly_event_count": int(sum(1 for r in score_rows if r["event_label"] == "anomaly")),
}
with open(DATA_DIR / "overall_care.json", "w") as f:
    json.dump(overall, f, indent=2)
print("Saved overall_care.json")

# ── Print summary ──────────────────────────────────────────────────────────────
print("\n=== CARE Score Summary ===")
print(f"  Coverage  (F2, anomaly events): {coverage_score:.4f}")
print(f"  Accuracy  (TN rate, normal):    {accuracy_score:.4f}")
print(f"  Reliability (ER_F2):            {reliability_score:.4f}")
print(f"  Earliness (WS):                 {earliness_score:.4f}")
print(f"  CARE (weighted):                {care_score:.4f}")
if care_zero_reason:
    print(f"  NOTE: CARE forced to 0 ({care_zero_reason})")

print("\n=== Per-Event Results ===")
print(f"{'Event':>8} {'Label':>8} {'Coverage':>10} {'RelAlarm':>10} {'Earliness':>10}")
for r in score_rows:
    cov = f"{r['coverage']:.3f}" if r['coverage'] is not None else "  N/A"
    rel = str(r['reliability_alarm']) if r['reliability_alarm'] is not None else "  N/A"
    ear = f"{r['earliness_weight']:.3f}" if r['earliness_weight'] is not None else "  N/A"
    print(f"{r['event_id']:>8} {r['event_label']:>8} {cov:>10} {rel:>10} {ear:>10}")
