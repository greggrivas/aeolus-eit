#!/usr/bin/env python3
"""
02_train.py — Train Isolation Forest on normal SCADA rows from train_data.parquet.
Saves: models/isolation_forest.joblib, scaler.joblib, model_metadata.json
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

# ── Paths ──────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "processed"
MODELS_DIR = ROOT / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# ── Load train data ────────────────────────────────────────────────────────────
train_df = pd.read_parquet(DATA_DIR / "train_data.parquet")
print(f"Loaded train data: {train_df.shape}")

# Feature columns = all columns except event_id
feature_cols = [c for c in train_df.columns if c != "event_id"]
print(f"Feature columns: {len(feature_cols)}")

X_all = train_df[feature_cols].copy()
# Drop any columns that are all-NaN, fill remaining NaN with column median
X_all = X_all.dropna(axis=1, how="all")
feature_cols = list(X_all.columns)
X_all = X_all.fillna(X_all.median())

# ── Train/val split (80/20 within normal rows) ─────────────────────────────────
np.random.seed(42)
n = len(X_all)
idx = np.random.permutation(n)
split = int(0.8 * n)
train_idx = idx[:split]
val_idx = idx[split:]

X_train = X_all.iloc[train_idx].values
X_val = X_all.iloc[val_idx].values

# ── Scale ──────────────────────────────────────────────────────────────────────
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_val_scaled = scaler.transform(X_val)

# ── Train Isolation Forest ─────────────────────────────────────────────────────
print("Training Isolation Forest...")
model = IsolationForest(n_estimators=100, contamination="auto", random_state=42, n_jobs=-1)
model.fit(X_train_scaled)
print("Training complete.")

# ── Threshold: 5th percentile of validation normal scores ─────────────────────
val_scores = model.score_samples(X_val_scaled)
threshold = float(np.percentile(val_scores, 5))
print(f"Anomaly threshold (5th pct of val scores): {threshold:.6f}")

# ── Validation FP rate check ──────────────────────────────────────────────────
val_preds = (val_scores < threshold).astype(int)
fp_rate = val_preds.mean()
print(f"Validation FP rate: {fp_rate:.3f} (expected ~0.05)")

# ── Save ───────────────────────────────────────────────────────────────────────
joblib.dump(model, MODELS_DIR / "isolation_forest.joblib")
joblib.dump(scaler, MODELS_DIR / "scaler.joblib")

metadata = {
    "algorithm": "IsolationForest",
    "n_estimators": 100,
    "contamination": "auto",
    "random_state": 42,
    "feature_cols": feature_cols,
    "threshold": threshold,
    "train_rows": int(len(X_train)),
    "val_rows": int(len(X_val)),
    "val_fp_rate": round(float(fp_rate), 4),
    "train_date": datetime.now(timezone.utc).isoformat(),
    "score_meaning": "Higher score = more normal. score < threshold → anomaly.",
}
with open(MODELS_DIR / "model_metadata.json", "w") as f:
    json.dump(metadata, f, indent=2)

print(f"\nSaved to {MODELS_DIR}:")
print("  isolation_forest.joblib")
print("  scaler.joblib")
print("  model_metadata.json")

# ── Sanity check: all-zero row ─────────────────────────────────────────────────
zero_row = np.zeros((1, len(feature_cols)))
zero_scaled = scaler.transform(zero_row)
zero_score = float(model.score_samples(zero_scaled)[0])
print(f"\nSanity check — all-zero row score: {zero_score:.6f} (threshold: {threshold:.6f})")
print(f"  → {'ANOMALY (expected)' if zero_score < threshold else 'NORMAL (unexpected!)'}")
