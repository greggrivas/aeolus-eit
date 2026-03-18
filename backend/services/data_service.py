from __future__ import annotations

from typing import Optional

import pandas as pd

from ..startup import get_state
from ..schemas.event import EventSummary, TimeseriesResponse, TimeseriesPoint, FeatureInfo


def _join_care(catalog_row: pd.Series, scores_df: pd.DataFrame) -> dict:
    """Join CARE scores for a catalog row."""
    eid = catalog_row["event_id"]
    score_row = scores_df[scores_df["event_id"] == eid]
    care_data = {}
    if not score_row.empty:
        r = score_row.iloc[0]
        care_data["coverage"] = float(r["coverage"]) if pd.notna(r["coverage"]) else None
        care_data["reliability_alarm"] = bool(r["reliability_alarm"]) if pd.notna(r.get("reliability_alarm")) else None
        care_data["earliness_weight"] = float(r["earliness_weight"]) if pd.notna(r.get("earliness_weight")) else None
        care_data["has_detection"] = bool(r.get("has_detection", False))
    return care_data


def list_events(label_filter: str = "all") -> list[EventSummary]:
    state = get_state()
    catalog = state.events_catalog
    scores = state.scores_summary

    if label_filter in ("anomaly", "normal"):
        catalog = catalog[catalog["event_label"] == label_filter]

    results = []
    for _, row in catalog.iterrows():
        care_data = _join_care(row, scores)
        results.append(EventSummary(
            event_id=int(row["event_id"]),
            event_label=str(row["event_label"]),
            event_description=str(row.get("event_description", "")),
            asset_id=int(row.get("asset_id", 0)),
            event_start=str(row["event_start"]),
            event_end=str(row["event_end"]),
            row_count=int(row["row_count"]),
            train_rows=int(row["train_rows"]),
            prediction_rows=int(row["prediction_rows"]),
            usable_train_rows=int(row["usable_train_rows"]),
            status_dist=str(row.get("status_dist", "{}")),
            **care_data,
        ))
    return results


def get_event(event_id: str) -> Optional[EventSummary]:
    state = get_state()
    catalog = state.events_catalog
    scores = state.scores_summary

    row_matches = catalog[catalog["event_id"] == int(event_id)]
    if row_matches.empty:
        return None

    row = row_matches.iloc[0]
    care_data = _join_care(row, scores)
    return EventSummary(
        event_id=int(row["event_id"]),
        event_label=str(row["event_label"]),
        event_description=str(row.get("event_description", "")),
        asset_id=int(row.get("asset_id", 0)),
        event_start=str(row["event_start"]),
        event_end=str(row["event_end"]),
        row_count=int(row["row_count"]),
        train_rows=int(row["train_rows"]),
        prediction_rows=int(row["prediction_rows"]),
        usable_train_rows=int(row["usable_train_rows"]),
        status_dist=str(row.get("status_dist", "{}")),
        **care_data,
    )


def get_timeseries(event_id: str, feature: str, downsample: int = 500) -> Optional[TimeseriesResponse]:
    state = get_state()
    df = state.event_data.get(event_id)
    if df is None:
        return None

    # Only prediction rows for the timeseries view
    pred_df = df[df["train_test"] == "prediction"].copy()
    if len(pred_df) == 0:
        pred_df = df.copy()

    pred_df = pred_df.sort_values("time_stamp").reset_index(drop=True)

    # Downsample
    total_rows = len(pred_df)
    if total_rows > downsample:
        step = max(1, total_rows // downsample)
        pred_df = pred_df.iloc[::step].reset_index(drop=True)

    # Feature description lookup
    feat_desc = ""
    if feature in state.feature_description.columns or len(state.feature_description) > 0:
        fd = state.feature_description
        # Match by sensor_name prefix (column might be sensor_0_avg, sensor name is sensor_0)
        sensor_base = feature.replace("_avg", "").replace("_max", "").replace("_min", "").replace("_std", "")
        match = fd[fd["sensor_name"] == sensor_base]
        if not match.empty:
            feat_desc = str(match.iloc[0].get("description", ""))

    points = []
    for _, row in pred_df.iterrows():
        fval = float(row[feature]) if feature in row.index and pd.notna(row[feature]) else None
        ascore = float(row["anomaly_score"]) if "anomaly_score" in row.index and pd.notna(row.get("anomaly_score")) else None
        points.append(TimeseriesPoint(
            time_stamp=str(row["time_stamp"]),
            anomaly_score=ascore,
            pred_anomaly=int(row.get("pred_anomaly", 0)),
            status_type_id=int(row["status_type_id"]),
            feature_value=fval,
        ))

    return TimeseriesResponse(
        event_id=int(event_id),
        feature=feature,
        feature_description=feat_desc,
        total_rows=total_rows,
        returned_rows=len(points),
        points=points,
    )


def get_features(event_id: str) -> list[FeatureInfo]:
    state = get_state()
    df = state.event_data.get(event_id)
    if df is None:
        return []

    non_sensor = {"time_stamp", "asset_id", "id", "train_test", "status_type_id",
                  "event_id", "event_label", "event_description", "paper_is_normal",
                  "is_implausible", "usable_for_training", "anomaly_score", "pred_anomaly"}
    sensor_cols = [c for c in df.columns if c not in non_sensor]

    fd = state.feature_description
    results = []
    for col in sensor_cols:
        sensor_base = col.replace("_avg", "").replace("_max", "").replace("_min", "").replace("_std", "")
        # Determine statistics type from suffix
        if col.endswith("_avg"):
            stats_type = "average"
        elif col.endswith("_max"):
            stats_type = "maximum"
        elif col.endswith("_min"):
            stats_type = "minimum"
        elif col.endswith("_std"):
            stats_type = "std_dev"
        else:
            stats_type = "average"

        desc = col
        unit = ""
        if len(fd) > 0:
            match = fd[fd["sensor_name"] == sensor_base]
            if not match.empty:
                desc = str(match.iloc[0].get("description", col))
                unit = str(match.iloc[0].get("unit", ""))

        results.append(FeatureInfo(
            column_name=col,
            sensor_name=sensor_base,
            description=desc,
            unit=unit,
            statistics_type=stats_type,
        ))
    return results
