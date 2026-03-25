#!/usr/bin/env python3
"""
05_supervised.py — Supervised binary classifier for anomaly detection.

Uses all labelled prediction rows (anomaly event rows = 1, normal event rows = 0)
to train a Random Forest classifier. Replaces the unsupervised Isolation Forest
as the primary detection signal.

Outputs:
  - Adds pred_anomaly_sup + anomaly_score_sup columns to all event parquets
  - Saves models/random_forest.joblib + models/rf_metadata.json
  - Overwrites data/processed/scores_summary.parquet with supervised CARE scores
  - Overwrites data/processed/overall_care.json with supervised CARE scores
"""
from __future__ import annotations

import json
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import cross_val_predict, StratifiedKFold

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "processed"
MODELS_DIR = ROOT / "models"

with open(MODELS_DIR / "model_metadata.json") as f:
    metadata = json.load(f)
feature_cols = metadata["feature_cols"]

catalog = pd.read_parquet(DATA_DIR / "events_catalog.parquet")

# ── Load all prediction rows ────────────────────────────────────────────────────
print("Loading prediction rows...")
all_rows: list[pd.DataFrame] = []
for _, cat_row in catalog.iterrows():
    eid = str(int(cat_row["event_id"]))
    p = DATA_DIR / f"event_{eid}.parquet"
    if not p.exists():
        continue
    df = pd.read_parquet(p)
    pred_df = df[df["train_test"] == "prediction"].copy()
    if len(pred_df) == 0:
        continue
    pred_df["_event_id"] = int(eid)
    pred_df["_label"] = 1 if cat_row["event_label"] == "anomaly" else 0
    all_rows.append(pred_df)

combined = pd.concat(all_rows, ignore_index=True)
print(f"  Total rows: {len(combined):,}  |  anomaly: {combined['_label'].sum():,}  |  normal: {(combined['_label']==0).sum():,}")

# Feature matrix
X = combined[feature_cols].copy()
for col in feature_cols:
    if col not in X.columns:
        X[col] = 0.0
X = X.fillna(X.median())
y = combined["_label"].values
groups = combined["_event_id"].values  # for group-aware CV

# ── Train final model on all data ──────────────────────────────────────────────
print("\nTraining Random Forest...")
rf = RandomForestClassifier(
    n_estimators=200,
    max_depth=12,
    min_samples_leaf=10,
    class_weight="balanced",
    random_state=42,
    n_jobs=-1,
)
rf.fit(X, y)
print("  Done.")

# Training set performance (optimistic — use CV for real estimate)
train_proba = rf.predict_proba(X)[:, 1]
train_auc = roc_auc_score(y, train_proba)
print(f"  Train AUC: {train_auc:.4f}")

# ── Cross-validation (Leave-One-Event-Out) ─────────────────────────────────────
print("\nLeave-One-Event-Out CV...")
event_ids = sorted(combined["_event_id"].unique())
cv_proba = np.zeros(len(combined))
cv_pred = np.zeros(len(combined), dtype=int)

for eid in event_ids:
    test_mask = groups == eid
    train_mask = ~test_mask
    if train_mask.sum() == 0 or test_mask.sum() == 0:
        continue
    cv_rf = RandomForestClassifier(
        n_estimators=100, max_depth=12, min_samples_leaf=10,
        class_weight="balanced", random_state=42, n_jobs=-1,
    )
    cv_rf.fit(X[train_mask], y[train_mask])
    cv_proba[test_mask] = cv_rf.predict_proba(X[test_mask])[:, 1]
    cv_pred[test_mask] = cv_rf.predict(X[test_mask])

cv_auc = roc_auc_score(y, cv_proba)
print(f"  LOEO CV AUC: {cv_auc:.4f}")
print(classification_report(y, cv_pred, target_names=["normal", "anomaly"]))

# Feature importance
importances = rf.feature_importances_
feat_imp = sorted(zip(feature_cols, importances), key=lambda x: x[1], reverse=True)
print("\nTop 15 features:")
for feat, imp in feat_imp[:15]:
    print(f"  {feat:<35} {imp:.4f}")

# ── Save model ─────────────────────────────────────────────────────────────────
rf_meta = {
    "algorithm": "RandomForestClassifier",
    "n_estimators": 200,
    "max_depth": 12,
    "min_samples_leaf": 10,
    "class_weight": "balanced",
    "feature_cols": feature_cols,
    "feature_count": len(feature_cols),
    "train_rows": int(len(combined)),
    "anomaly_rows": int(combined["_label"].sum()),
    "normal_rows": int((combined["_label"] == 0).sum()),
    "train_auc": round(train_auc, 4),
    "cv_auc": round(cv_auc, 4),
    "top_features": [{"feature": f, "importance": round(float(i), 5)} for f, i in feat_imp[:20]],
}
joblib.dump(rf, MODELS_DIR / "random_forest.joblib")
with open(MODELS_DIR / "rf_metadata.json", "w") as f:
    json.dump(rf_meta, f, indent=2)
print(f"\nSaved random_forest.joblib + rf_metadata.json")

# ── Add supervised predictions to event parquets ───────────────────────────────
print("\nUpdating event parquets with supervised predictions...")
for _, cat_row in catalog.iterrows():
    eid = str(int(cat_row["event_id"]))
    p = DATA_DIR / f"event_{eid}.parquet"
    if not p.exists():
        continue
    df = pd.read_parquet(p)
    pred_mask = df["train_test"] == "prediction"

    df["anomaly_score_sup"] = np.nan
    df["pred_anomaly_sup"] = 0

    if pred_mask.any():
        X_pred = df.loc[pred_mask, feature_cols].copy()
        for col in feature_cols:
            if col not in X_pred.columns:
                X_pred[col] = 0.0
        X_pred = X_pred.fillna(X_pred.median())
        proba = rf.predict_proba(X_pred)[:, 1]
        pred = (proba >= 0.5).astype(int)
        df.loc[pred_mask, "anomaly_score_sup"] = proba
        df.loc[pred_mask, "pred_anomaly_sup"] = pred

    df.to_parquet(p, index=False)
    n_flagged = int(df.loc[pred_mask, "pred_anomaly_sup"].sum()) if pred_mask.any() else 0
    print(f"  event_{eid}: {pred_mask.sum()} rows, {n_flagged} flagged")

# ── Recompute CARE scores with supervised predictions ──────────────────────────
print("\nRecomputing CARE scores with supervised predictions...")

events: dict[str, pd.DataFrame] = {}
for p in sorted(DATA_DIR.glob("event_*.parquet")):
    eid = p.stem.replace("event_", "")
    df = pd.read_parquet(p)
    pred_df = df[df["train_test"] == "prediction"].copy()
    if len(pred_df) > 0:
        # Use supervised predictions
        if "pred_anomaly_sup" in pred_df.columns:
            pred_df["pred_anomaly"] = pred_df["pred_anomaly_sup"]
        events[eid] = pred_df


def compute_coverage(pred_df: pd.DataFrame) -> float | None:
    exclude = {1, 3, 4, 5}
    filtered = pred_df[~pred_df["status_type_id"].isin(exclude)]
    if len(filtered) == 0:
        return None
    y_true = np.ones(len(filtered), dtype=int)
    y_pred = filtered["pred_anomaly"].values.astype(int)
    tp = int(((y_true == 1) & (y_pred == 1)).sum())
    fp = int(((y_true == 0) & (y_pred == 1)).sum())
    fn = int(((y_true == 1) & (y_pred == 0)).sum())
    denom = 5 * tp + 4 * fn + fp
    return float((5 * tp) / denom) if denom > 0 else 0.0


def compute_reliability(pred_df: pd.DataFrame) -> bool:
    criticality = 0
    for _, row in pred_df.iterrows():
        pred = int(row["pred_anomaly"])
        status = int(row["status_type_id"])
        if pred == 1 and status == 0:
            criticality += 1
        elif pred == 0 and status == 0:
            criticality = max(0, criticality - 1)
        if criticality >= 36:
            return True
    return False


def compute_earliness(pred_df: pd.DataFrame) -> float | None:
    pred_df = pred_df.reset_index(drop=True)
    n = len(pred_df)
    detected = pred_df.index[pred_df["pred_anomaly"] == 1].tolist()
    if not detected:
        return None
    first = detected[0]
    half_n = n / 2
    return 1.0 if first <= half_n else max(0.0, 1.0 - 2 * (first - half_n) / n)


score_rows = []
total_tn, total_normal_pred = 0, 0
anomaly_labels, reliability_preds = [], []
coverage_values, earliness_values = [], []

for _, cat_row in catalog.iterrows():
    eid_str = str(int(cat_row["event_id"]))
    label = cat_row["event_label"]
    pred_df = events.get(eid_str)

    if pred_df is None or len(pred_df) == 0:
        score_rows.append({"event_id": cat_row["event_id"], "event_label": label,
                           "coverage": None, "reliability_alarm": None,
                           "earliness_weight": None, "has_detection": False, "lead_time_hours": None})
        continue

    coverage = reliability_alarm = earliness_weight = lead_time_hours = None

    if label == "anomaly":
        coverage = compute_coverage(pred_df)
        coverage_values.append(coverage if coverage is not None else 0.0)
        reliability_alarm = compute_reliability(pred_df)
        anomaly_labels.append(1)
        reliability_preds.append(1 if reliability_alarm else 0)
        earliness_weight = compute_earliness(pred_df)
        if earliness_weight is not None:
            earliness_values.append(earliness_weight)
        pred_df_r = pred_df.reset_index(drop=True)
        detected = pred_df_r.index[pred_df_r["pred_anomaly"] == 1].tolist()
        if detected:
            first_ts = pd.Timestamp(pred_df_r.iloc[detected[0]]["time_stamp"])
            last_ts = pd.Timestamp(pred_df_r.iloc[-1]["time_stamp"])
            lead_time_hours = round((last_ts - first_ts).total_seconds() / 3600, 2)
    elif label == "normal":
        tn = int((pred_df["pred_anomaly"] == 0).sum())
        fp = int((pred_df["pred_anomaly"] == 1).sum())
        total_tn += tn
        total_normal_pred += tn + fp
        reliability_alarm = compute_reliability(pred_df)
        anomaly_labels.append(0)
        reliability_preds.append(1 if reliability_alarm else 0)

    score_rows.append({
        "event_id": cat_row["event_id"], "event_label": label,
        "coverage": float(coverage) if coverage is not None else None,
        "reliability_alarm": bool(reliability_alarm) if reliability_alarm is not None else None,
        "earliness_weight": float(earliness_weight) if earliness_weight is not None else None,
        "has_detection": bool(pred_df["pred_anomaly"].any()),
        "lead_time_hours": lead_time_hours,
    })

coverage_score = float(np.mean(coverage_values)) if coverage_values else 0.0
accuracy_score = (total_tn / total_normal_pred) if total_normal_pred > 0 else 0.0

if anomaly_labels:
    ya = np.array(anomaly_labels); yp = np.array(reliability_preds)
    tp_r = int(((ya == 1) & (yp == 1)).sum())
    fp_r = int(((ya == 0) & (yp == 1)).sum())
    fn_r = int(((ya == 1) & (yp == 0)).sum())
    denom_r = 5 * tp_r + 4 * fn_r + fp_r
    reliability_score = float((5 * tp_r) / denom_r) if denom_r > 0 else 0.0
else:
    reliability_score = 0.0

earliness_score = float(np.mean(earliness_values)) if earliness_values else 0.0
care_raw = (coverage_score + 2 * earliness_score + reliability_score + 2 * accuracy_score) / 7
detected_any = any(r["has_detection"] for r in score_rows if r["event_label"] == "anomaly")
care_score = care_raw if (detected_any and accuracy_score >= 0.5) else 0.0

scores_df = pd.DataFrame(score_rows)
scores_df.to_parquet(DATA_DIR / "scores_summary.parquet", index=False)

overall = {
    "coverage": round(coverage_score, 4),
    "accuracy": round(accuracy_score, 4),
    "reliability": round(reliability_score, 4),
    "earliness": round(earliness_score, 4),
    "care": round(care_score, 4),
    "care_zero_reason": None if (detected_any and accuracy_score >= 0.5) else ("no_detections" if not detected_any else "accuracy_below_0.5"),
    "total_normal_prediction_rows": int(total_normal_pred),
    "total_tn": int(total_tn),
    "anomaly_events_with_detection": int(sum(1 for r in score_rows if r["event_label"] == "anomaly" and r["has_detection"])),
    "anomaly_event_count": int(sum(1 for r in score_rows if r["event_label"] == "anomaly")),
    "model": "RandomForest",
}
with open(DATA_DIR / "overall_care.json", "w") as f:
    json.dump(overall, f, indent=2)

print("\n=== Supervised CARE Results ===")
print(f"  Coverage:    {coverage_score:.4f}")
print(f"  Accuracy:    {accuracy_score:.4f}")
print(f"  Reliability: {reliability_score:.4f}")
print(f"  Earliness:   {earliness_score:.4f}")
print(f"  CARE:        {care_score:.4f}")
print(f"\nSaved scores_summary.parquet + overall_care.json")
print("Done.")
