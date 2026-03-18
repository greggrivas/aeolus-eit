from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class CareScores(BaseModel):
    coverage: float
    accuracy: float
    reliability: float
    earliness: float
    care: float
    care_zero_reason: Optional[str] = None
    total_normal_prediction_rows: int
    total_tn: int
    anomaly_events_with_detection: int
    anomaly_event_count: int


class EventCareBreakdown(BaseModel):
    event_id: int
    event_label: str
    coverage: Optional[float]
    reliability_alarm: Optional[bool]
    earliness_weight: Optional[float]
    has_detection: bool


class PredictionRequest(BaseModel):
    features: dict[str, float]


class PredictionResult(BaseModel):
    anomaly_score: float
    is_anomaly: bool
    threshold: float
    features_used: int
