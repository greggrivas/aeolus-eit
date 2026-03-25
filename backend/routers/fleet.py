from __future__ import annotations

import numpy as np
import pandas as pd

from fastapi import APIRouter

from ..startup import get_state
from ..schemas.fleet import AssetOverview, FleetKpis, FleetOverviewResponse

router = APIRouter(prefix="/api/fleet", tags=["fleet"])


@router.get("/overview", response_model=FleetOverviewResponse)
def get_fleet_overview() -> FleetOverviewResponse:
    state = get_state()
    catalog = state.events_catalog
    event_data = state.event_data
    scores = state.scores_summary

    asset_ids = sorted(catalog["asset_id"].unique().tolist())
    assets: list[AssetOverview] = []

    for asset_id in asset_ids:
        asset_catalog = catalog[catalog["asset_id"] == asset_id]
        anomaly_events = asset_catalog[asset_catalog["event_label"] == "anomaly"]

        fault_events = len(anomaly_events)

        # Count detections via scores_summary
        detected = 0
        missed = 0
        coverage_values: list[float] = []

        for _, row in anomaly_events.iterrows():
            eid = row["event_id"]
            score_row = scores[scores["event_id"] == eid] if not scores.empty else pd.DataFrame()
            has_det = False
            cov = None
            if not score_row.empty:
                r = score_row.iloc[0]
                has_det = bool(r.get("has_detection", False))
                if pd.notna(r.get("coverage")):
                    cov = float(r["coverage"])
            if has_det:
                detected += 1
            else:
                missed += 1
            if cov is not None:
                coverage_values.append(cov)

        avg_coverage = float(np.mean(coverage_values)) if coverage_values else 0.0

        # Collect all prediction rows for this asset across all events
        all_pred_rows: list[pd.DataFrame] = []
        for _, row in asset_catalog.iterrows():
            eid = str(int(row["event_id"]))
            if eid in event_data:
                df = event_data[eid]
                # prediction rows: those without NaN anomaly_score (model ran on them)
                pred_df = df[df["anomaly_score"].notna()] if "anomaly_score" in df.columns else df
                all_pred_rows.append(pred_df)

        availability_pct: float | None = None
        power_deficit_pct: float | None = None
        avg_power_fault: float | None = None
        avg_power_normal: float | None = None

        if all_pred_rows:
            combined = pd.concat(all_pred_rows, ignore_index=True)

            # Availability: % of prediction rows where status_type_id == 0
            if "status_type_id" in combined.columns and len(combined) > 0:
                availability_pct = float((combined["status_type_id"] == 0).sum() / len(combined) * 100)

            # Power deficit
            if "power_30_avg" in combined.columns and "pred_anomaly" in combined.columns:
                fault_mask = combined["pred_anomaly"] == 1
                normal_mask = combined["pred_anomaly"] == 0
                fault_power = combined.loc[fault_mask, "power_30_avg"].dropna()
                normal_power = combined.loc[normal_mask, "power_30_avg"].dropna()
                if len(fault_power) > 0 and len(normal_power) > 0:
                    fault_mean = float(fault_power.mean())
                    normal_mean = float(normal_power.mean())
                    avg_power_fault = fault_mean
                    avg_power_normal = normal_mean
                    if normal_mean != 0:
                        power_deficit_pct = float((normal_mean - fault_mean) / normal_mean * 100)

        # Health score
        if fault_events == 0:
            health_score = 100
        else:
            total_faults = fault_events
            score = 100.0
            score -= (missed / total_faults) * 50
            score -= (1.0 - avg_coverage) * 30
            health_score = max(0, round(score))

        # Health state
        if missed > 0:
            health_state = "critical"
        elif avg_coverage < 0.3 and detected > 0:
            health_state = "warning"
        else:
            health_state = "healthy"

        # Avg lead time: mean lead_time_hours for detected anomaly events of this asset
        asset_event_ids = asset_catalog["event_id"].tolist()
        lead_rows = scores[
            scores["event_id"].isin(asset_event_ids)
            & (scores["has_detection"] == True)
            & (scores["event_label"] == "anomaly")
        ]["lead_time_hours"].dropna()
        avg_lead_time_hours: float | None = float(lead_rows.mean()) if len(lead_rows) > 0 else None

        # MTBF: mean days between consecutive anomaly event starts for this asset
        anomaly_starts = (
            pd.to_datetime(
                asset_catalog[asset_catalog["event_label"] == "anomaly"]["event_start"].dropna()
            )
            .sort_values()
        )
        mtbf_days: float | None = None
        if len(anomaly_starts) >= 2:
            diffs = anomaly_starts.diff().dropna().dt.total_seconds() / 86400
            mtbf_days = float(diffs.mean())

        assets.append(AssetOverview(
            asset_id=int(asset_id),
            health_state=health_state,
            health_score=health_score,
            fault_events=fault_events,
            detected=detected,
            missed=missed,
            availability_pct=availability_pct,
            power_deficit_pct=power_deficit_pct,
            avg_power_fault=avg_power_fault,
            avg_power_normal=avg_power_normal,
            avg_lead_time_hours=avg_lead_time_hours,
            mtbf_days=mtbf_days,
        ))

    # Fleet KPIs
    total_assets = len(assets)
    critical = sum(1 for a in assets if a.health_state == "critical")
    warning = sum(1 for a in assets if a.health_state == "warning")
    healthy = sum(1 for a in assets if a.health_state == "healthy")
    active_alerts = sum(1 for a in assets if a.missed > 0)
    assets_needing_maintenance = critical + warning

    avail_values = [a.availability_pct for a in assets if a.availability_pct is not None]
    fleet_availability_pct = float(np.mean(avail_values)) if avail_values else None

    deficit_values = [
        a.power_deficit_pct
        for a in assets
        if a.power_deficit_pct is not None and a.power_deficit_pct >= 0
    ]
    avg_power_deficit_pct = float(np.mean(deficit_values)) if deficit_values else None

    # False alarm rate: % of normal-event prediction rows flagged as anomaly
    false_alarm_rate_pct: float | None = None
    normal_event_ids = catalog[catalog["event_label"] == "normal"]["event_id"].tolist()
    normal_pred_rows: list[pd.DataFrame] = []
    for eid in normal_event_ids:
        eid_str = str(int(eid))
        if eid_str in event_data:
            df = event_data[eid_str]
            if "pred_anomaly" in df.columns:
                pred_df = df[df["anomaly_score"].notna()] if "anomaly_score" in df.columns else df
                normal_pred_rows.append(pred_df[["pred_anomaly"]])
    if normal_pred_rows:
        combined_normal = pd.concat(normal_pred_rows, ignore_index=True)
        total_normal = len(combined_normal)
        if total_normal > 0:
            false_positives = int((combined_normal["pred_anomaly"] == 1).sum())
            false_alarm_rate_pct = float(false_positives / total_normal * 100)

    lead_time_values = [a.avg_lead_time_hours for a in assets if a.avg_lead_time_hours is not None]
    fleet_avg_lead_time_hours = float(np.mean(lead_time_values)) if lead_time_values else None

    mtbf_values = [a.mtbf_days for a in assets if a.mtbf_days is not None]
    fleet_mtbf_days = float(np.mean(mtbf_values)) if mtbf_values else None

    kpis = FleetKpis(
        total_assets=total_assets,
        critical=critical,
        warning=warning,
        healthy=healthy,
        fleet_availability_pct=fleet_availability_pct,
        active_alerts=active_alerts,
        assets_needing_maintenance=assets_needing_maintenance,
        avg_power_deficit_pct=avg_power_deficit_pct,
        false_alarm_rate_pct=false_alarm_rate_pct,
        fleet_avg_lead_time_hours=fleet_avg_lead_time_hours,
        fleet_mtbf_days=fleet_mtbf_days,
    )

    return FleetOverviewResponse(assets=assets, kpis=kpis)
