from __future__ import annotations

from fastapi import APIRouter

from ..startup import get_state
from ..schemas.care import CareScores, EventCareBreakdown

router = APIRouter(prefix="/api/scores", tags=["scores"])


@router.get("/summary", response_model=CareScores)
def get_scores_summary():
    state = get_state()
    return CareScores(**state.overall_care)


@router.get("/events", response_model=list[EventCareBreakdown])
def get_event_scores():
    state = get_state()
    scores_df = state.scores_summary

    results = []
    for _, row in scores_df.iterrows():
        results.append(EventCareBreakdown(
            event_id=int(row["event_id"]),
            event_label=str(row["event_label"]),
            coverage=float(row["coverage"]) if row.get("coverage") is not None and str(row["coverage"]) != "nan" else None,
            reliability_alarm=bool(row["reliability_alarm"]) if row.get("reliability_alarm") is not None and str(row["reliability_alarm"]) != "nan" else None,
            earliness_weight=float(row["earliness_weight"]) if row.get("earliness_weight") is not None and str(row["earliness_weight"]) != "nan" else None,
            has_detection=bool(row.get("has_detection", False)),
        ))
    return results
