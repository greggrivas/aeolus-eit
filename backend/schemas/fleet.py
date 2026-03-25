from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class AssetOverview(BaseModel):
    asset_id: int
    health_state: str          # "critical" | "warning" | "healthy"
    health_score: int          # 0-100
    fault_events: int
    detected: int
    missed: int
    availability_pct: Optional[float]    # % of prediction rows with status_type_id == 0
    power_deficit_pct: Optional[float]   # % power drop during fault rows vs normal rows
    avg_power_fault: Optional[float]
    avg_power_normal: Optional[float]
    avg_lead_time_hours: Optional[float] # mean hours of advance warning across detected events
    mtbf_days: Optional[float]           # mean days between consecutive fault events
    trend_slope: Optional[float]         # slope of anomaly_score over last 500 prediction rows (neg = degrading)


class FleetKpis(BaseModel):
    total_assets: int
    critical: int
    warning: int
    healthy: int
    fleet_availability_pct: Optional[float]
    active_alerts: int
    assets_needing_maintenance: int
    avg_power_deficit_pct: Optional[float]
    false_alarm_rate_pct: Optional[float]    # % of normal-event prediction rows flagged as anomaly
    fleet_avg_lead_time_hours: Optional[float]
    fleet_mtbf_days: Optional[float]


class FleetOverviewResponse(BaseModel):
    assets: list[AssetOverview]
    kpis: FleetKpis
