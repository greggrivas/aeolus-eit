from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class TopSensor(BaseModel):
    sensor: str
    description: str
    z_score: float


class SubsystemSignal(BaseModel):
    key: str
    label: str
    icon: str
    color: str
    signal: float          # 0–1 normalised (z-score / 5, capped at 1)
    mean_z_score: float
    description: str
    sensors_checked: int
    sensors_available: int
    top_sensor: Optional[str] = None
    top_sensor_description: Optional[str] = None
    top_z_score: Optional[float] = None
    top_sensors: list[TopSensor] = []   # top 3 driving sensors
    trend_pct: Optional[float] = None   # change in signal from first→second half of prediction rows (pp)
    history: list[float] = []           # 16 signal values bucketed across prediction rows


class SubsystemSignalsResponse(BaseModel):
    event_id: int
    event_label: str
    has_anomaly_rows: bool
    subsystems: list[SubsystemSignal]
