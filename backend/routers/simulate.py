from __future__ import annotations

import random
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Query

from ..startup import get_state
from ..schemas.simulate import SimulationResult, SimulationPoint

router = APIRouter(prefix="/api/simulate", tags=["simulate"])


@router.get("", response_model=SimulationResult)
def run_simulation(
    n: int = Query(default=150, ge=20, le=500),
    event_id: Optional[str] = Query(default=None),
    seed: Optional[int] = Query(default=None),
):
    state = get_state()
    rng = random.Random(seed)

    # Pick event — prefer anomaly events for interesting results
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

    # Sample n consecutive rows from a random starting point
    total = len(pred_df)
    if total == 0 or "anomaly_score" not in pred_df.columns:
        # Fall back to first anomaly event with scores
        for fallback_id, fallback_df in state.event_data.items():
            fpred = fallback_df[fallback_df["train_test"] == "prediction"]
            if len(fpred) > n and "anomaly_score" in fpred.columns:
                eid = fallback_id
                pred_df = fpred.reset_index(drop=True)
                total = len(pred_df)
                catalog_row = state.events_catalog[state.events_catalog["event_id"] == int(eid)]
                break

    max_start = max(0, total - n)
    start_idx = rng.randint(0, max_start)
    sample = pred_df.iloc[start_idx: start_idx + n].reset_index(drop=True)

    threshold = state.model_metadata.get("threshold", -0.5)
    event_label = str(catalog_row.iloc[0]["event_label"]) if not catalog_row.empty else "unknown"
    event_desc = str(catalog_row.iloc[0].get("event_description", "")) if not catalog_row.empty else ""

    points = []
    first_detection = None
    anomaly_count = 0

    for i, row in sample.iterrows():
        score = float(row["anomaly_score"]) if pd.notna(row.get("anomaly_score")) else 0.0
        is_anom = int(row.get("pred_anomaly", 0))
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
        sample_start_pct=round(start_idx / max(total, 1), 3),
        threshold=threshold,
        total_sampled=len(points),
        anomaly_count=anomaly_count,
        first_detection_index=first_detection,
        points=points,
    )
