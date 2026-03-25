from __future__ import annotations

import random
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Query

from ..startup import get_state
from ..schemas.simulate import SimulationResult, SimulationPoint
from ..services.data_service import _pred_col, _score_col

router = APIRouter(prefix="/api/simulate", tags=["simulate"])


@router.get("", response_model=SimulationResult)
def run_simulation(
    n: int = Query(default=150, ge=20, le=500),
    event_id: Optional[str] = Query(default=None),
    seed: Optional[int] = Query(default=None),
):
    state = get_state()
    rng = random.Random(seed)

    # Pick event — prefer anomaly events
    if event_id:
        eid = event_id
    else:
        anomaly_ids = state.events_catalog[
            state.events_catalog["event_label"] == "anomaly"
        ]["event_id"].astype(str).tolist()
        eid = rng.choice(anomaly_ids)

    df = state.event_data.get(eid)
    catalog_row = state.events_catalog[state.events_catalog["event_id"] == int(eid)]

    pred_df = df[df["train_test"] == "prediction"].copy().reset_index(drop=True) if df is not None else pd.DataFrame()

    score_col = _score_col(pred_df) if len(pred_df) > 0 else "anomaly_score"
    pred_col = _pred_col(pred_df) if len(pred_df) > 0 else "pred_anomaly"

    total = len(pred_df)
    if total == 0 or score_col not in pred_df.columns:
        for fallback_id, fallback_df in state.event_data.items():
            fpred = fallback_df[fallback_df["train_test"] == "prediction"]
            sc = _score_col(fpred)
            if len(fpred) > n and sc in fpred.columns:
                eid = fallback_id
                pred_df = fpred.reset_index(drop=True)
                total = len(pred_df)
                score_col = sc
                pred_col = _pred_col(pred_df)
                catalog_row = state.events_catalog[state.events_catalog["event_id"] == int(eid)]
                break

    max_start = max(0, total - n)
    start_idx = rng.randint(0, max_start)
    sample = pred_df.iloc[start_idx: start_idx + n].reset_index(drop=True)

    threshold = state.model_metadata.get("threshold", -0.5)
    event_label = str(catalog_row.iloc[0]["event_label"]) if not catalog_row.empty else "unknown"
    event_desc = str(catalog_row.iloc[0].get("event_description", "")) if not catalog_row.empty else ""
    asset_id = int(catalog_row.iloc[0]["asset_id"]) if not catalog_row.empty and "asset_id" in catalog_row.columns else None

    # Fault zone: first row in sample where status_type_id != 0 (turbine not in normal operation)
    fault_zone_start: int | None = None
    if "status_type_id" in sample.columns:
        fault_rows = sample[sample["status_type_id"] != 0]
        if not fault_rows.empty:
            fault_zone_start = int(fault_rows.index[0])

    points = []
    first_detection = None
    anomaly_count = 0

    for i, row in sample.iterrows():
        score = float(row[score_col]) if pd.notna(row.get(score_col)) else 0.0
        is_anom = int(row.get(pred_col, 0))
        if is_anom and first_detection is None:
            first_detection = int(i)
        anomaly_count += is_anom
        points.append(SimulationPoint(
            index=int(i),
            time_stamp=str(row["time_stamp"]),
            anomaly_score=round(score, 4),
            pred_anomaly=is_anom,
        ))

    return SimulationResult(
        event_id=int(eid),
        event_label=event_label,
        event_description=event_desc,
        asset_id=asset_id,
        sample_start_pct=round(start_idx / max(total, 1), 3),
        threshold=threshold,
        total_sampled=len(points),
        anomaly_count=anomaly_count,
        first_detection_index=first_detection,
        fault_zone_start_index=fault_zone_start,
        points=points,
    )
