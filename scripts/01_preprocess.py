#!/usr/bin/env python3
"""
01_preprocess.py — Load Wind Farm A event CSVs, enrich with metadata,
derive flags, and save per-event parquets plus catalog and train data.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

# ── Paths ──────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "CARE_To_Compare" / "Wind Farm A"
DATASETS_DIR = RAW_DIR / "datasets"
OUT_DIR = ROOT / "data" / "processed"
OUT_DIR.mkdir(parents=True, exist_ok=True)

NORMAL_STATUS_IDS = {0, 2}

# ── Load metadata ──────────────────────────────────────────────────────────────
event_info = pd.read_csv(RAW_DIR / "event_info.csv", sep=";")
feature_desc = pd.read_csv(RAW_DIR / "feature_description.csv", sep=";")

# Identify sensor columns (all columns after status_type_id in the CSVs)
NON_SENSOR_COLS = {"time_stamp", "asset_id", "id", "train_test", "status_type_id"}

# ── Process each event ─────────────────────────────────────────────────────────
catalog_rows = []
train_dfs = []

for _, row in event_info.iterrows():
    event_id = str(row["event_id"])
    csv_path = DATASETS_DIR / f"{event_id}.csv"
    if not csv_path.exists():
        print(f"  WARN: {csv_path} not found, skipping")
        continue

    df = pd.read_csv(csv_path, sep=";", low_memory=False)
    df["time_stamp"] = pd.to_datetime(df["time_stamp"])

    # Derive sensor columns from this df
    sensor_cols = [c for c in df.columns if c not in NON_SENSOR_COLS]

    # ── Enrich with event metadata ─────────────────────────────────────────────
    df["event_id"] = int(event_id)
    df["event_label"] = row["event_label"]
    df["event_description"] = row.get("event_description", "")

    # ── Derived flags ──────────────────────────────────────────────────────────
    df["paper_is_normal"] = df["status_type_id"].isin(NORMAL_STATUS_IDS)

    # Plausibility: wind > cut-in but power near zero (not generating), OR power > rated ceiling
    wind_col = "wind_speed_3_avg"
    power_col = "power_30_avg"
    near_zero = 0.02      # 2% of normalized rated power
    rated_ceiling = 1.05  # 5% above normalized rated power
    cut_in_speed = 3.0    # m/s

    df["is_implausible"] = (
        (df[wind_col] > cut_in_speed) & (df[power_col] < near_zero)
    ) | (df[power_col] > rated_ceiling)

    df["usable_for_training"] = df["paper_is_normal"] & ~df["is_implausible"]

    # ── Save per-event parquet ─────────────────────────────────────────────────
    out_path = OUT_DIR / f"event_{event_id}.parquet"
    df.to_parquet(out_path, index=False)
    print(f"  Saved {out_path.name}: {len(df)} rows, "
          f"usable_train={df['usable_for_training'].sum()}")

    # ── Catalog row ───────────────────────────────────────────────────────────
    status_dist = df["status_type_id"].value_counts().to_dict()
    catalog_rows.append({
        "event_id": int(event_id),
        "event_label": row["event_label"],
        "event_description": row.get("event_description", ""),
        "asset_id": int(row["asset"]),
        "event_start": str(row["event_start"]),
        "event_end": str(row["event_end"]),
        "row_count": len(df),
        "train_rows": int((df["train_test"] == "train").sum()),
        "prediction_rows": int((df["train_test"] == "prediction").sum()),
        "usable_train_rows": int(df["usable_for_training"].sum()),
        "status_dist": json.dumps({int(k): int(v) for k, v in status_dist.items()}),
    })

    # ── Collect train rows ────────────────────────────────────────────────────
    train_mask = (df["train_test"] == "train") & df["usable_for_training"]
    if train_mask.any():
        train_dfs.append(df[train_mask][["event_id"] + sensor_cols].copy())

# ── Save catalog ───────────────────────────────────────────────────────────────
catalog_df = pd.DataFrame(catalog_rows)
catalog_df.to_parquet(OUT_DIR / "events_catalog.parquet", index=False)
print(f"\nCatalog saved: {len(catalog_df)} events")

# ── Save train data ────────────────────────────────────────────────────────────
if train_dfs:
    train_df = pd.concat(train_dfs, ignore_index=True)
    # Verify: all rows should have come from normal status (status in {0,2})
    train_df.to_parquet(OUT_DIR / "train_data.parquet", index=False)
    print(f"Train data saved: {len(train_df)} rows from {len(train_dfs)} events")
else:
    print("ERROR: No training data collected!", file=sys.stderr)
    sys.exit(1)

# ── Verify ─────────────────────────────────────────────────────────────────────
print("\n=== Verification ===")
print(f"Event parquets: {len(list(OUT_DIR.glob('event_*.parquet')))}")
print(f"Catalog events: {len(catalog_df)}")
print(f"Train rows: {len(train_df)}")
print(f"Train feature cols: {len(sensor_cols)}")
print("\nRows per event (train):")
for r in catalog_rows:
    print(f"  event_{r['event_id']}: {r['usable_train_rows']} usable train rows ({r['event_label']})")
