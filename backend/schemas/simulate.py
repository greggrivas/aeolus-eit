from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class SimulationPoint(BaseModel):
    index: int
    time_stamp: str
    anomaly_score: float
    pred_anomaly: int


class SimulationResult(BaseModel):
    event_id: int
    event_label: str
    event_description: str
    sample_start_pct: float
    threshold: float
    total_sampled: int
    anomaly_count: int
    first_detection_index: Optional[int]
    points: list[SimulationPoint]
