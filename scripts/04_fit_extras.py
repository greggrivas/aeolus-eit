#!/usr/bin/env python3
"""
04_fit_extras.py — Additional models for predictive maintenance insights.

1. Power Curve Model: polynomial regression wind_speed → expected power
   - Fits on normal-event training rows (status_type_id == 0, wind > 0)
   - Adds power_curve_residual (kW) and power_curve_residual_pct (%)
     to all event parquets' prediction rows
   - Saves models/power_curve.joblib

2. Fault Type Classifier: subsystem z-score features → fault category
   - 12 anomaly events → 4 classes: hydraulic, gearbox, generator, transformer
   - Features: mean abs z-score per subsystem group across prediction rows
   - Logistic regression with LOOCV validation
   - Saves models/fault_classifier.joblib + data/processed/fault_predictions.json
"""
from __future__ import annotations

import json
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
from sklearn.model_selection import LeaveOneOut
from sklearn.preprocessing import LabelEncoder

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "processed"
MODELS_DIR = ROOT / "models"

# ── Load scaler for z-score computation ────────────────────────────────────────
scaler = joblib.load(MODELS_DIR / "scaler.joblib")
with open(MODELS_DIR / "model_metadata.json") as f:
    metadata = json.load(f)
feature_cols = metadata["feature_cols"]
feat_idx = {f: i for i, f in enumerate(feature_cols)}
means = scaler.mean_
stds = scaler.scale_

catalog = pd.read_parquet(DATA_DIR / "events_catalog.parquet")


# ══════════════════════════════════════════════════════════════════════════════
# 1. Power Curve Model
# ══════════════════════════════════════════════════════════════════════════════
print("=== 1. Power Curve Model ===")

WIND_COL = "wind_speed_3_avg"
POWER_COL = "power_30_avg"
POLY_DEGREE = 5
CUT_IN = 3.5  # m/s — below this, turbine produces 0 power normally

# Collect normal-event training rows (status_type_id == 0 only)
normal_ids = catalog[catalog["event_label"] == "normal"]["event_id"].tolist()
train_rows: list[pd.DataFrame] = []
for eid in normal_ids:
    p = DATA_DIR / f"event_{eid}.parquet"
    if not p.exists():
        continue
    df = pd.read_parquet(p)
    subset = df[
        (df["train_test"] == "train")
        & (df["status_type_id"] == 0)
        & df[WIND_COL].notna()
        & df[POWER_COL].notna()
        & (df[WIND_COL] > 3.5)   # above cut-in only — don't fit the zero region
        & (df[POWER_COL] > 0.01) # must be actually producing power
    ][[WIND_COL, POWER_COL]]
    train_rows.append(subset)

train_data = pd.concat(train_rows, ignore_index=True)
print(f"  Training rows: {len(train_data):,}")

ws_train = train_data[WIND_COL].clip(0, 30).values
pwr_train = train_data[POWER_COL].values

# Fit degree-5 polynomial
coeffs = np.polyfit(ws_train, pwr_train, deg=POLY_DEGREE)
poly_fn = np.poly1d(coeffs)

expected_train = poly_fn(ws_train).clip(0, None)
rmse = float(np.sqrt(np.mean((pwr_train - expected_train) ** 2)))
r2 = float(1 - np.sum((pwr_train - expected_train) ** 2) / np.sum((pwr_train - np.mean(pwr_train)) ** 2))
print(f"  RMSE: {rmse:.1f} kW  |  R²: {r2:.4f}")

power_curve_artifact = {
    "coeffs": coeffs.tolist(),
    "wind_col": WIND_COL,
    "power_col": POWER_COL,
    "degree": POLY_DEGREE,
    "cut_in_speed": CUT_IN,
    "rmse": rmse,
    "r2": r2,
}
joblib.dump(power_curve_artifact, MODELS_DIR / "power_curve.joblib")
print(f"  Saved power_curve.joblib")

# Add residuals to all event parquets
event_parquets = sorted(DATA_DIR.glob("event_*.parquet"))
print(f"  Updating {len(event_parquets)} event parquets...")
for path in event_parquets:
    df = pd.read_parquet(path)
    pred_mask = df["train_test"] == "prediction"

    df["power_curve_residual"] = np.nan
    df["power_curve_expected"] = np.nan
    df["power_curve_residual_pct"] = np.nan

    if pred_mask.any() and WIND_COL in df.columns and POWER_COL in df.columns:
        ws_pred = df.loc[pred_mask, WIND_COL].clip(0, 30).values
        # Expected power: 0 below cut-in, polynomial above
        exp_power = np.where(ws_pred >= CUT_IN, poly_fn(ws_pred).clip(0, None), 0.0)
        act_power = df.loc[pred_mask, POWER_COL].values
        residual = act_power - exp_power
        with np.errstate(divide="ignore", invalid="ignore"):
            # Only compute % when above cut-in and expected > threshold
            residual_pct = np.where(
                (ws_pred >= CUT_IN) & (exp_power > 0.05),
                residual / exp_power * 100,
                np.nan
            )
        df.loc[pred_mask, "power_curve_residual"] = residual
        df.loc[pred_mask, "power_curve_expected"] = exp_power
        df.loc[pred_mask, "power_curve_residual_pct"] = residual_pct

    df.to_parquet(path, index=False)

print(f"  Done.")
print()


# ══════════════════════════════════════════════════════════════════════════════
# 2. Fault Type Classifier
# ══════════════════════════════════════════════════════════════════════════════
print("=== 2. Fault Type Classifier ===")

# Ground-truth fault type labels (from event_description)
FAULT_LABELS: dict[int, str] = {
    68: "transformer",
    22: "hydraulic",
    72: "gearbox",
    73: "hydraulic",
    0:  "generator",
    26: "hydraulic",
    40: "generator",
    42: "hydraulic",
    10: "gearbox",
    45: "hydraulic",
    84: "hydraulic",
    51: "gearbox",
}

SUBSYSTEM_SENSORS: dict[str, list[str]] = {
    "gearbox":    ["sensor_11_avg", "sensor_12_avg"],
    "generator":  ["sensor_13_avg", "sensor_14_avg", "sensor_15_avg",
                   "sensor_16_avg", "sensor_17_avg", "sensor_18_avg"],
    "pitch":      ["sensor_5_avg", "sensor_6_avg"],
    "electrical": ["sensor_23_avg", "sensor_24_avg", "sensor_25_avg",
                   "sensor_32_avg", "sensor_33_avg", "sensor_34_avg",
                   "sensor_35_avg", "sensor_36_avg", "sensor_37_avg"],
    "nacelle":    ["sensor_7_avg", "sensor_42_avg", "sensor_43_avg"],
}
SUBSYSTEM_KEYS = list(SUBSYSTEM_SENSORS.keys())


def compute_subsystem_z_features(pred_df: pd.DataFrame) -> list[float]:
    """Mean abs z-score per subsystem group across anomaly (or all) prediction rows."""
    rows = pred_df[pred_df["pred_anomaly"] == 1] if "pred_anomaly" in pred_df.columns else pd.DataFrame()
    if len(rows) == 0:
        rows = pred_df  # fallback: use all prediction rows
    result = []
    for key in SUBSYSTEM_KEYS:
        zs = []
        for s in SUBSYSTEM_SENSORS[key]:
            if s in rows.columns and s in feat_idx:
                idx = feat_idx[s]
                if stds[idx] > 0:
                    vals = rows[s].dropna()
                    if len(vals) > 0:
                        zs.append(abs(float(vals.mean()) - means[idx]) / stds[idx])
        result.append(float(np.mean(zs)) if zs else 0.0)
    return result


# Build feature matrix
X_list, y_list, event_ids_used = [], [], []
for eid, fault_type in FAULT_LABELS.items():
    p = DATA_DIR / f"event_{eid}.parquet"
    if not p.exists():
        continue
    df = pd.read_parquet(p)
    pred_df = df[df["train_test"] == "prediction"]
    if len(pred_df) == 0:
        continue
    X_list.append(compute_subsystem_z_features(pred_df))
    y_list.append(fault_type)
    event_ids_used.append(eid)

X = np.array(X_list)
y = np.array(y_list)
le = LabelEncoder()
y_enc = le.fit_transform(y)

print(f"  Samples: {len(X)} events | Features: {SUBSYSTEM_KEYS}")
print(f"  Classes: {le.classes_.tolist()}")
print(f"  Distribution: { {c: int((y == c).sum()) for c in le.classes_} }")

# Train final model
clf = LogisticRegression(C=0.5, max_iter=1000, random_state=42, class_weight="balanced")
clf.fit(X, y_enc)

# LOOCV accuracy
loo = LeaveOneOut()
loocv_preds = []
for train_idx, test_idx in loo.split(X):
    cv = LogisticRegression(C=0.5, max_iter=1000, random_state=42, class_weight="balanced")
    cv.fit(X[train_idx], y_enc[train_idx])
    loocv_preds.append(int(cv.predict(X[test_idx])[0]))
loocv_acc = accuracy_score(y_enc, loocv_preds)
print(f"  LOOCV accuracy: {loocv_acc:.2f} ({int(loocv_acc * len(X))}/{len(X)} correct)")
print()
print(f"  {'Event':>6}  {'True':>12}  {'Pred':>12}  {'Conf':>6}  {'OK'}")

# Per-event predictions
predictions: dict[str, dict] = {}
for i, eid in enumerate(event_ids_used):
    proba = clf.predict_proba(X[i : i + 1])[0]
    pred_class = le.inverse_transform([int(np.argmax(proba))])[0]
    confidence = float(np.max(proba))
    correct = pred_class == FAULT_LABELS[eid]
    predictions[str(eid)] = {
        "fault_type": pred_class,
        "confidence": round(confidence, 3),
        "probabilities": {cls: round(float(p), 3) for cls, p in zip(le.classes_, proba)},
        "true_label": FAULT_LABELS[eid],
        "correct": correct,
    }
    print(f"  {eid:>6}  {FAULT_LABELS[eid]:>12}  {pred_class:>12}  {confidence:.2f}  {'✓' if correct else '✗'}")

# Save
joblib.dump(
    {
        "classifier": clf,
        "label_encoder": le,
        "subsystem_keys": SUBSYSTEM_KEYS,
        "subsystem_sensors": SUBSYSTEM_SENSORS,
        "loocv_accuracy": loocv_acc,
    },
    MODELS_DIR / "fault_classifier.joblib",
)
with open(DATA_DIR / "fault_predictions.json", "w") as f:
    json.dump(predictions, f, indent=2)

print()
print(f"  Saved fault_classifier.joblib + fault_predictions.json")
print(f"  NOTE: n=12 is small — treat predictions as indicative, not reliable")
print()
print("Done.")
