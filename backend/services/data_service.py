from __future__ import annotations

from typing import Optional

import pandas as pd

import numpy as np

from ..startup import get_state
from ..schemas.event import EventSummary, TimeseriesResponse, TimeseriesPoint, FeatureInfo, AttributionFeature, EventAttribution, PowerCurveResponse, PowerCurvePoint
from ..schemas.subsystem import SubsystemSignal, SubsystemSignalsResponse, TopSensor


# Prefer supervised RF predictions when available, fall back to Isolation Forest
def _pred_col(df: pd.DataFrame) -> str:
    return "pred_anomaly_sup" if "pred_anomaly_sup" in df.columns else "pred_anomaly"

def _score_col(df: pd.DataFrame) -> str:
    return "anomaly_score_sup" if "anomaly_score_sup" in df.columns else "anomaly_score"


SUBSYSTEM_GROUPS: dict[str, dict] = {
    "gearbox": {
        "label": "Gearbox",
        "icon": "settings",
        "color": "#f59e0b",
        "sensors": ["sensor_11_avg", "sensor_12_avg"],
        "description": "Bearing HS temp · Oil temp",
    },
    "generator": {
        "label": "Generator",
        "icon": "electric_bolt",
        "color": "#3b82f6",
        "sensors": ["sensor_13_avg", "sensor_14_avg", "sensor_15_avg", "sensor_16_avg", "sensor_17_avg", "sensor_18_avg"],
        "description": "Bearings · Stator windings ph.1/2/3 · RPM",
    },
    "pitch": {
        "label": "Pitch System",
        "icon": "rotate_right",
        "color": "#10b981",
        "sensors": ["sensor_5_avg", "sensor_6_avg"],
        "description": "Pitch angle · Hub controller temp",
    },
    "electrical": {
        "label": "Electrical / Power",
        "icon": "flash_on",
        "color": "#8b5cf6",
        "sensors": ["sensor_23_avg", "sensor_24_avg", "sensor_25_avg",
                    "sensor_32_avg", "sensor_33_avg", "sensor_34_avg",
                    "sensor_35_avg", "sensor_36_avg", "sensor_37_avg"],
        "description": "Current phases · Voltage phases · IGBT temps",
    },
    "nacelle": {
        "label": "Nacelle / Yaw",
        "icon": "explore",
        "color": "#06b6d4",
        "sensors": ["sensor_7_avg", "sensor_42_avg", "sensor_43_avg"],
        "description": "Top controller temp · Nacelle direction · Nacelle temp",
    },
}


def _join_fault_type(event_id: int, description: str = "") -> dict:
    """Return fault type from classifier prediction with confidence score."""
    state = get_state()
    fp = state.fault_predictions.get(str(event_id))
    if fp:
        return {"fault_type": fp["fault_type"], "fault_type_confidence": fp["confidence"]}
    return {}


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
        care_data["lead_time_hours"] = float(r["lead_time_hours"]) if "lead_time_hours" in r.index and pd.notna(r.get("lead_time_hours")) else None
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
        fault_data = _join_fault_type(int(row["event_id"]), str(row.get("event_description", ""))) if str(row["event_label"]) == "anomaly" else {}
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
            **fault_data,
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
    fault_data = _join_fault_type(int(row["event_id"]), str(row.get("event_description", ""))) if str(row["event_label"]) == "anomaly" else {}
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
        **fault_data,
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

    sc = _score_col(pred_df)
    pc = _pred_col(pred_df)
    points = []
    for _, row in pred_df.iterrows():
        fval = float(row[feature]) if feature in row.index and pd.notna(row[feature]) else None
        ascore = float(row[sc]) if sc in row.index and pd.notna(row.get(sc)) else None
        points.append(TimeseriesPoint(
            time_stamp=str(row["time_stamp"]),
            anomaly_score=ascore,
            pred_anomaly=int(row.get(pc, 0)),
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


def get_event_attribution(event_id: str) -> Optional[EventAttribution]:
    state = get_state()
    df = state.event_data.get(event_id)
    if df is None:
        return None

    pred_df = df[df["train_test"] == "prediction"].copy().reset_index(drop=True)
    if len(pred_df) == 0:
        return None

    catalog_row = state.events_catalog[state.events_catalog["event_id"] == int(event_id)]
    event_label = str(catalog_row.iloc[0]["event_label"]) if not catalog_row.empty else "unknown"

    pc = _pred_col(pred_df)
    sc = _score_col(pred_df)
    anomaly_rows = pred_df[pred_df[pc] == 1]
    anomaly_point_count = len(anomaly_rows)

    # Lead time: hours from first detection to end of prediction window (computed on-the-fly)
    lead_time_hours = None
    if anomaly_point_count > 0:
        detected_idxs = pred_df.index[pred_df[pc] == 1].tolist()
        first_ts = pd.Timestamp(pred_df.iloc[detected_idxs[0]]["time_stamp"])
        last_ts = pd.Timestamp(pred_df.iloc[-1]["time_stamp"])
        lead_time_hours = round((last_ts - first_ts).total_seconds() / 3600, 2)

    # Score trend: compare mean anomaly score of first vs last third of prediction window
    scores = pred_df[sc].dropna().tolist()
    score_trend = "no_detections"
    if len(scores) >= 6 and anomaly_point_count > 0:
        third = max(1, len(scores) // 3)
        first_mean = float(np.mean(scores[:third]))
        last_mean = float(np.mean(scores[-third:]))
        diff = last_mean - first_mean
        # Isolation Forest scores: more negative = more anomalous
        if diff < -0.02:
            score_trend = "escalating"
        elif diff > 0.02:
            score_trend = "improving"
        else:
            score_trend = "stable"
    elif anomaly_point_count > 0:
        score_trend = "stable"

    # Feature attribution via z-scores against training distribution (scaler mean/std)
    feature_cols = state.model_metadata.get("feature_cols", [])
    scaler = state.scaler
    fd = state.feature_description
    top_features: list[AttributionFeature] = []

    if anomaly_point_count > 0 and len(feature_cols) > 0:
        means = scaler.mean_
        stds = scaler.scale_
        scored = []
        for i, feat in enumerate(feature_cols):
            if feat not in anomaly_rows.columns:
                continue
            vals = anomaly_rows[feat].dropna()
            if len(vals) == 0 or stds[i] == 0:
                continue
            avg_val = float(vals.mean())
            z = abs((avg_val - means[i]) / stds[i])

            sensor_base = feat.replace("_avg", "").replace("_max", "").replace("_min", "").replace("_std", "")
            desc = feat
            if len(fd) > 0:
                match = fd[fd["sensor_name"] == sensor_base]
                if not match.empty:
                    desc = str(match.iloc[0].get("description", feat))

            scored.append(AttributionFeature(
                feature=feat,
                description=desc,
                z_score=round(z, 3),
                mean=round(float(means[i]), 4),
                std=round(float(stds[i]), 4),
                anomaly_mean_value=round(avg_val, 4),
            ))

        scored.sort(key=lambda x: x.z_score, reverse=True)
        top_features = scored[:10]

    return EventAttribution(
        event_id=int(event_id),
        event_label=event_label,
        anomaly_point_count=anomaly_point_count,
        total_prediction_rows=len(pred_df),
        lead_time_hours=lead_time_hours,
        score_trend=score_trend,
        top_features=top_features,
    )


def get_power_curve_scatter(event_id: str, max_points: int = 1000) -> Optional[PowerCurveResponse]:
    state = get_state()
    df = state.event_data.get(event_id)
    if df is None:
        return None

    pca = state.power_curve  # power curve artifact
    if not pca:
        return PowerCurveResponse(
            event_id=int(event_id), points=[], curve_x=[], curve_y=[],
            mean_deficit_normal=None, mean_deficit_anomaly=None, has_power_curve=False,
        )

    wind_col = pca.get("wind_col", "wind_speed_3_avg")
    power_col = pca.get("power_col", "power_30_avg")

    pred_df = df[df["train_test"] == "prediction"].copy()
    pred_c = _pred_col(pred_df)
    required = {wind_col, power_col, pred_c, "power_curve_expected"}
    if not required.issubset(pred_df.columns):
        return PowerCurveResponse(
            event_id=int(event_id), points=[], curve_x=[], curve_y=[],
            mean_deficit_normal=None, mean_deficit_anomaly=None, has_power_curve=False,
        )

    pred_df = pred_df.dropna(subset=[wind_col, power_col, "power_curve_expected"]).copy()
    if len(pred_df) == 0:
        return PowerCurveResponse(
            event_id=int(event_id), points=[], curve_x=[], curve_y=[],
            mean_deficit_normal=None, mean_deficit_anomaly=None, has_power_curve=False,
        )

    # Downsample evenly
    if len(pred_df) > max_points:
        step = max(1, len(pred_df) // max_points)
        pred_df = pred_df.iloc[::step]

    points = [
        PowerCurvePoint(
            wind_speed=round(float(r[wind_col]), 3),
            actual_power=round(float(r[power_col]), 4),
            expected_power=round(float(r["power_curve_expected"]), 4),
            pred_anomaly=int(r.get(pred_c, 0)),
        )
        for _, r in pred_df.iterrows()
    ]

    # Smooth fitted curve line from cut-in to max wind speed
    coeffs = pca.get("coeffs", [])
    poly_fn = np.poly1d(coeffs)
    cut_in = pca.get("cut_in_speed", 3.5)
    max_ws = float(pred_df[wind_col].max())
    xs = np.linspace(0, min(max_ws + 1, 30), 100)
    ys = np.where(xs >= cut_in, poly_fn(xs).clip(0, None), 0.0)
    curve_x = [round(float(x), 2) for x in xs]
    curve_y = [round(float(y), 4) for y in ys]

    # Mean deficit stats
    if "power_curve_residual_pct" in pred_df.columns:
        normal_rows = pred_df[pred_df[pred_c] == 0]["power_curve_residual_pct"].dropna()
        anomaly_rows = pred_df[pred_df[pred_c] == 1]["power_curve_residual_pct"].dropna()
        mean_deficit_normal = round(float(normal_rows.mean()), 2) if len(normal_rows) > 0 else None
        mean_deficit_anomaly = round(float(anomaly_rows.mean()), 2) if len(anomaly_rows) > 0 else None
    else:
        mean_deficit_normal = mean_deficit_anomaly = None

    return PowerCurveResponse(
        event_id=int(event_id),
        points=points,
        curve_x=curve_x,
        curve_y=curve_y,
        mean_deficit_normal=mean_deficit_normal,
        mean_deficit_anomaly=mean_deficit_anomaly,
        has_power_curve=True,
    )


def get_subsystem_signals(event_id: str) -> Optional[SubsystemSignalsResponse]:
    state = get_state()
    df = state.event_data.get(event_id)
    if df is None:
        return None

    catalog_row = state.events_catalog[state.events_catalog["event_id"] == int(event_id)]
    event_label = str(catalog_row.iloc[0]["event_label"]) if not catalog_row.empty else "unknown"

    pred_df = df[df["train_test"] == "prediction"].copy().reset_index(drop=True)
    pred_c = _pred_col(pred_df)
    anomaly_rows = pred_df[pred_df[pred_c] == 1] if pred_c in pred_df.columns else pd.DataFrame()
    has_anomaly_rows = len(anomaly_rows) > 0

    feature_cols = state.model_metadata.get("feature_cols", [])
    scaler = state.scaler
    fd = state.feature_description

    # Build lookup: sensor_col → z-score during anomaly rows
    z_map: dict[str, float] = {}
    z_desc: dict[str, str] = {}
    if has_anomaly_rows and scaler is not None and len(feature_cols) > 0:
        means = scaler.mean_
        stds = scaler.scale_
        for i, feat in enumerate(feature_cols):
            if feat not in anomaly_rows.columns:
                continue
            vals = anomaly_rows[feat].dropna()
            if len(vals) == 0 or stds[i] == 0:
                continue
            z_map[feat] = float(abs((vals.mean() - means[i]) / stds[i]))
            # description lookup
            sensor_base = feat.replace("_avg", "").replace("_max", "").replace("_min", "").replace("_std", "")
            desc = feat
            if len(fd) > 0:
                match = fd[fd["sensor_name"] == sensor_base]
                if not match.empty:
                    desc = str(match.iloc[0].get("description", feat))
            z_desc[feat] = desc

    # Build feat_idx_map + means/stds for history bucketing
    feat_idx_map: dict[str, int] = {}
    if scaler is not None and len(feature_cols) > 0:
        means = scaler.mean_
        stds = scaler.scale_
        for i, f in enumerate(feature_cols):
            feat_idx_map[f] = i
    else:
        means = np.zeros(0)
        stds = np.ones(0)

    def _row_signal_for_sensors(df_slice: pd.DataFrame, sensors: list[str]) -> float:
        """Mean abs z-score for a set of sensors over a dataframe slice."""
        zs = []
        for s in sensors:
            if s not in df_slice.columns or s not in feat_idx_map:
                continue
            idx = feat_idx_map[s]
            if stds[idx] == 0:
                continue
            vals = df_slice[s].dropna()
            if len(vals) == 0:
                continue
            zs.append(float(abs(vals.mean() - means[idx]) / stds[idx]))
        return float(np.mean(zs)) if zs else 0.0

    N_BUCKETS = 16

    subsystems: list[SubsystemSignal] = []
    for key, grp in SUBSYSTEM_GROUPS.items():
        sensors_defined = grp["sensors"]
        sensors_available = [s for s in sensors_defined if s in pred_df.columns]
        sensors_with_z = [s for s in sensors_available if s in z_map]

        if sensors_with_z:
            z_scores = [z_map[s] for s in sensors_with_z]
            mean_z = float(np.mean(z_scores))
            ranked = sorted(sensors_with_z, key=lambda s: z_map[s], reverse=True)
            best_sensor = ranked[0]
            top_z = z_map[best_sensor]
            top_desc = z_desc.get(best_sensor, best_sensor)
            top_sensors = [
                TopSensor(sensor=s, description=z_desc.get(s, s), z_score=round(z_map[s], 3))
                for s in ranked[:3]
            ]
        else:
            mean_z = 0.0
            best_sensor = None
            top_z = None
            top_desc = None
            top_sensors = []

        signal = min(1.0, mean_z / 5.0)

        # Trend: compare signal in first half vs second half of prediction rows
        trend_pct: float | None = None
        n = len(pred_df)
        if n >= 10 and sensors_with_z:
            half = n // 2
            first_z = _row_signal_for_sensors(pred_df.iloc[:half], sensors_with_z)
            second_z = _row_signal_for_sensors(pred_df.iloc[half:], sensors_with_z)
            first_sig = min(1.0, first_z / 5.0)
            second_sig = min(1.0, second_z / 5.0)
            trend_pct = round((second_sig - first_sig) * 100, 1)

        # History: 16 buckets across prediction rows
        history: list[float] = []
        if n >= N_BUCKETS and sensors_available:
            bucket_size = n // N_BUCKETS
            for b in range(N_BUCKETS):
                chunk = pred_df.iloc[b * bucket_size : (b + 1) * bucket_size]
                bz = _row_signal_for_sensors(chunk, sensors_available)
                history.append(round(min(1.0, bz / 5.0), 4))

        subsystems.append(SubsystemSignal(
            key=key,
            label=grp["label"],
            icon=grp["icon"],
            color=grp["color"],
            signal=round(signal, 4),
            mean_z_score=round(mean_z, 3),
            description=grp["description"],
            sensors_checked=len(sensors_defined),
            sensors_available=len(sensors_available),
            top_sensor=best_sensor,
            top_sensor_description=top_desc,
            top_z_score=round(top_z, 3) if top_z is not None else None,
            top_sensors=top_sensors,
            trend_pct=trend_pct,
            history=history,
        ))

    # Sort by signal descending
    subsystems.sort(key=lambda s: s.signal, reverse=True)

    return SubsystemSignalsResponse(
        event_id=int(event_id),
        event_label=event_label,
        has_anomaly_rows=has_anomaly_rows,
        subsystems=subsystems,
    )
