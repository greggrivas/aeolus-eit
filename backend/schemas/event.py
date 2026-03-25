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
    lead_time_hours: Optional[float] = None
    # Fault type (from fault classifier, anomaly events only)
    fault_type: Optional[str] = None
    fault_type_confidence: Optional[float] = None


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


class AttributionFeature(BaseModel):
    feature: str
    description: str
    z_score: float
    mean: float
    std: float
    anomaly_mean_value: float


class PowerCurvePoint(BaseModel):
    wind_speed: float
    actual_power: float
    expected_power: float
    pred_anomaly: int


class PowerCurveResponse(BaseModel):
    event_id: int
    points: list[PowerCurvePoint]
    curve_x: list[float]   # smooth fitted curve x-values
    curve_y: list[float]   # smooth fitted curve y-values
    mean_deficit_normal: Optional[float]   # mean residual_pct for normal rows
    mean_deficit_anomaly: Optional[float]  # mean residual_pct for anomaly rows
    has_power_curve: bool


class EventAttribution(BaseModel):
    event_id: int
    event_label: str
    anomaly_point_count: int
    total_prediction_rows: int
    lead_time_hours: Optional[float]
    score_trend: str  # "escalating" | "stable" | "decreasing" | "no_detections"
    top_features: list[AttributionFeature]
