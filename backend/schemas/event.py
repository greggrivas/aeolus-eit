from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class EventSummary(BaseModel):
    event_id: int
    event_label: str
    event_description: str
    asset_id: int
    event_start: str
    event_end: str
    row_count: int
    train_rows: int
    prediction_rows: int
    usable_train_rows: int
    status_dist: str  # JSON string
    # CARE joined
    coverage: Optional[float] = None
    accuracy: Optional[float] = None
    reliability_alarm: Optional[bool] = None
    earliness_weight: Optional[float] = None
    has_detection: bool = False


class EventDetail(EventSummary):
    pass


class TimeseriesPoint(BaseModel):
    time_stamp: str
    anomaly_score: Optional[float]
    pred_anomaly: int
    status_type_id: int
    feature_value: Optional[float]


class TimeseriesResponse(BaseModel):
    event_id: int
    feature: str
    feature_description: str
    total_rows: int
    returned_rows: int
    points: list[TimeseriesPoint]


class FeatureInfo(BaseModel):
    column_name: str
    sensor_name: str
    description: str
    unit: str
    statistics_type: str
