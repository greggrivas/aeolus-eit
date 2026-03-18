from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class SubsystemSignal(BaseModel):
    key: str
    label: str
    icon: str
    color: str
    signal: float          # 0–1 normalised (z-score / 5, capped at 1)
    mean_z_score: float
    description: str
    sensors_checked: int   # sensors in this group defined in SUBSYSTEM_GROUPS
    sensors_available: int # sensors actually present in this parquet
    top_sensor: Optional[str] = None
    top_sensor_description: Optional[str] = None
    top_z_score: Optional[float] = None


class SubsystemSignalsResponse(BaseModel):
    event_id: int
    event_label: str
    has_anomaly_rows: bool
    subsystems: list[SubsystemSignal]
