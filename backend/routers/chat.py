"""
Tool-calling chat agent for Aeolus.
Uses OpenRouter with tool_use so the LLM can query real wind farm data.
"""
from __future__ import annotations

import json
from typing import Optional

import httpx
import pandas as pd
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..core.config import settings
from ..services.data_service import get_event, get_event_attribution
from ..startup import get_state

router = APIRouter(prefix="/api", tags=["chat"])

SYSTEM_PROMPT = (
    "You are an AI assistant for Aeolus, a wind turbine predictive maintenance platform. "
    "You help maintenance operators understand anomaly detection results, CARE benchmark scores, and maintenance priorities for Wind Farm A. "
    "You have tools that query real SCADA data — use them to give accurate, grounded answers. "
    "Never invent numbers. Be concise, technical, and prioritise actionable recommendations."
)

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_fleet_summary",
            "description": "Get overall fleet KPIs: CARE scores, detection rate, total assets and events, average lead time.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_turbine_info",
            "description": "Get all events and detection results for a specific turbine/asset.",
            "parameters": {
                "type": "object",
                "properties": {
                    "asset_id": {"type": "integer", "description": "The turbine/asset ID number"},
                },
                "required": ["asset_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_event_details",
            "description": "Get metadata and CARE scores for a specific fault event.",
            "parameters": {
                "type": "object",
                "properties": {
                    "event_id": {"type": "integer", "description": "The event ID"},
                },
                "required": ["event_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_sensor_attribution",
            "description": "Get the top sensors driving anomaly detection for an event, with z-scores showing deviation from normal.",
            "parameters": {
                "type": "object",
                "properties": {
                    "event_id": {"type": "integer", "description": "The event ID"},
                },
                "required": ["event_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_maintenance_priorities",
            "description": "Get a ranked list of all turbines by maintenance urgency based on fault detection history.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_sensor",
            "description": (
                "Search all event prediction rows for sensor readings that exceed or fall below a threshold. "
                "Use to answer questions like 'which turbines had gearbox temp above 70' or 'where did power drop below 0.1'. "
                "Sensor columns follow the pattern sensor_N_avg (e.g. sensor_11_avg = gearbox bearing HS temp, "
                "sensor_12_avg = gearbox oil temp, sensor_13_avg = generator bearing DE temp, power_30_avg = active power)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "sensor_col": {"type": "string", "description": "Sensor column name, e.g. 'sensor_12_avg'"},
                    "operator": {"type": "string", "enum": ["gt", "lt", "gte", "lte"], "description": "gt=>  lt=<  gte=>=  lte=<="},
                    "threshold": {"type": "number", "description": "Threshold value to compare against"},
                },
                "required": ["sensor_col", "operator", "threshold"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_work_order",
            "description": "Generate a structured maintenance work order for a turbine based on its fault detection results and top contributing sensors.",
            "parameters": {
                "type": "object",
                "properties": {
                    "asset_id": {"type": "integer", "description": "The turbine/asset ID"},
                    "event_id": {"type": "integer", "description": "Specific event to base the work order on (optional — defaults to most recent detected fault)"},
                },
                "required": ["asset_id"],
            },
        },
    },
]


def _execute_tool(name: str, args: dict) -> str:
    state = get_state()

    if name == "get_fleet_summary":
        care = state.overall_care
        catalog = state.events_catalog
        scores = state.scores_summary
        anomaly_count = int((catalog["event_label"] == "anomaly").sum())
        anomaly_scores = scores[scores["event_label"] == "anomaly"] if "event_label" in scores.columns else pd.DataFrame()
        detected_anomalies = int((anomaly_scores["has_detection"] == True).sum()) if len(anomaly_scores) > 0 else 0
        lead_times = scores["lead_time_hours"].dropna().tolist() if "lead_time_hours" in scores.columns else []
        avg_lead = round(sum(lead_times) / len(lead_times), 1) if lead_times else None
        return json.dumps({
            "care_score": care.get("care"),
            "coverage": care.get("coverage"),
            "accuracy": care.get("accuracy"),
            "reliability": care.get("reliability"),
            "earliness": care.get("earliness"),
            "total_assets": int(catalog["asset_id"].nunique()),
            "anomaly_events": anomaly_count,
            "normal_events": int((catalog["event_label"] == "normal").sum()),
            "detected_faults": detected_anomalies,
            "detection_rate": f"{(detected_anomalies / anomaly_count * 100):.1f}%" if anomaly_count > 0 else "0%",
            "avg_lead_time_hours": avg_lead,
        })

    elif name == "get_turbine_info":
        asset_id = args.get("asset_id")
        catalog = state.events_catalog
        scores = state.scores_summary
        asset_events = catalog[catalog["asset_id"] == asset_id]
        if asset_events.empty:
            return json.dumps({"error": f"No events found for asset {asset_id}"})
        result = []
        for _, row in asset_events.iterrows():
            eid = int(row["event_id"])
            score_row = scores[scores["event_id"] == eid]
            ev: dict = {
                "event_id": eid,
                "label": str(row["event_label"]),
                "description": str(row.get("event_description", "")),
                "start": str(row["event_start"]),
                "end": str(row["event_end"]),
            }
            if not score_row.empty:
                r = score_row.iloc[0]
                ev["has_detection"] = bool(r.get("has_detection", False))
                ev["coverage"] = float(r["coverage"]) if pd.notna(r.get("coverage")) else None
                ev["lead_time_hours"] = float(r["lead_time_hours"]) if "lead_time_hours" in r.index and pd.notna(r.get("lead_time_hours")) else None
                ev["reliability_alarm"] = bool(r["reliability_alarm"]) if pd.notna(r.get("reliability_alarm")) else None
            result.append(ev)
        return json.dumps({"asset_id": asset_id, "events": result})

    elif name == "get_event_details":
        ev = get_event(str(args.get("event_id")))
        if ev:
            return json.dumps(ev.model_dump())
        return json.dumps({"error": f"Event {args.get('event_id')} not found"})

    elif name == "get_sensor_attribution":
        attr = get_event_attribution(str(args.get("event_id")))
        if attr:
            d = attr.model_dump()
            d["top_features"] = d["top_features"][:5]  # limit response size
            return json.dumps(d)
        return json.dumps({"error": f"No attribution data for event {args.get('event_id')}"})

    elif name == "get_maintenance_priorities":
        catalog = state.events_catalog
        scores = state.scores_summary
        priorities = []
        for asset_id in sorted(catalog["asset_id"].unique()):
            asset_events = catalog[catalog["asset_id"] == int(asset_id)]
            asset_faults = asset_events[asset_events["event_label"] == "anomaly"]
            if len(asset_faults) == 0:
                priorities.append({
                    "asset_id": int(asset_id),
                    "fault_events": 0, "detected": 0, "missed": 0,
                    "avg_coverage": None, "urgency": "LOW",
                    "recommendation": "No fault history — routine monitoring",
                })
                continue
            eid_list = asset_faults["event_id"].tolist()
            asset_scores = scores[scores["event_id"].isin(eid_list)]
            detected = int((asset_scores["has_detection"] == True).sum()) if "has_detection" in asset_scores.columns else 0
            missed = len(asset_faults) - detected
            coverage_vals = asset_scores["coverage"].dropna().tolist()
            avg_cov = round(sum(coverage_vals) / len(coverage_vals), 3) if coverage_vals else None
            if missed > 0:
                urgency, rec = "HIGH", f"Inspection required — {missed} fault(s) not detected by model"
            elif avg_cov is not None and avg_cov < 0.3:
                urgency, rec = "MEDIUM", "Low detection coverage on fault events — schedule maintenance"
            else:
                urgency, rec = "LOW", "All faults detected — schedule routine maintenance"
            priorities.append({
                "asset_id": int(asset_id), "fault_events": len(asset_faults),
                "detected": detected, "missed": missed,
                "avg_coverage": avg_cov, "urgency": urgency, "recommendation": rec,
            })
        priorities.sort(key=lambda x: (x["missed"], x["fault_events"]), reverse=True)
        return json.dumps(priorities)

    elif name == "query_sensor":
        sensor_col = args.get("sensor_col", "")
        operator = args.get("operator", "gt")
        threshold = float(args.get("threshold", 0))
        op_map = {"gt": lambda x, t: x > t, "lt": lambda x, t: x < t,
                  "gte": lambda x, t: x >= t, "lte": lambda x, t: x <= t}
        op_fn = op_map.get(operator, op_map["gt"])

        catalog = state.events_catalog
        fd = state.feature_description
        sensor_desc = sensor_col
        if len(fd) > 0:
            base = sensor_col.replace("_avg", "").replace("_max", "").replace("_min", "").replace("_std", "")
            match = fd[fd["sensor_name"] == base]
            if not match.empty:
                sensor_desc = str(match.iloc[0].get("description", sensor_col))

        results = []
        for event_id_str, df in state.event_data.items():
            pred_df = df[df["train_test"] == "prediction"]
            if sensor_col not in pred_df.columns:
                continue
            vals = pred_df[sensor_col].dropna()
            matching = vals[op_fn(vals, threshold)]
            if len(matching) == 0:
                continue
            cat_row = catalog[catalog["event_id"] == int(event_id_str)]
            results.append({
                "event_id": int(event_id_str),
                "asset_id": int(cat_row.iloc[0]["asset_id"]) if not cat_row.empty else None,
                "event_label": str(cat_row.iloc[0]["event_label"]) if not cat_row.empty else "unknown",
                "matching_rows": len(matching),
                "total_prediction_rows": len(pred_df),
                "max_value": round(float(vals.max()), 4),
                "mean_during_match": round(float(matching.mean()), 4),
            })
        results.sort(key=lambda x: x["matching_rows"], reverse=True)
        return json.dumps({
            "sensor": sensor_col, "sensor_description": sensor_desc,
            "query": f"{sensor_col} {operator} {threshold}",
            "events_with_matches": len(results),
            "results": results[:10],
        })

    elif name == "generate_work_order":
        from datetime import datetime, timezone as tz
        asset_id = args.get("asset_id")
        event_id_arg = args.get("event_id")
        catalog = state.events_catalog
        scores = state.scores_summary

        if event_id_arg:
            target_eid = str(event_id_arg)
        else:
            asset_faults = catalog[(catalog["asset_id"] == asset_id) & (catalog["event_label"] == "anomaly")]
            if asset_faults.empty:
                return json.dumps({"error": f"No fault events for asset {asset_id}"})
            eid_list = asset_faults["event_id"].tolist()
            asset_scores = scores[scores["event_id"].isin(eid_list)]
            detected = asset_scores[asset_scores["has_detection"] == True]
            target_eid = str(int(detected.iloc[-1]["event_id"]) if not detected.empty else int(asset_faults.iloc[-1]["event_id"]))

        cat_row = catalog[catalog["event_id"] == int(target_eid)]
        if cat_row.empty:
            return json.dumps({"error": f"Event {target_eid} not found"})
        cat = cat_row.iloc[0]
        event_desc = str(cat.get("event_description", ""))

        attr = get_event_attribution(target_eid)
        top_sensors = []
        if attr and attr.top_features:
            for feat in attr.top_features[:5]:
                top_sensors.append({
                    "sensor": feat.feature, "description": feat.description,
                    "z_score": feat.z_score,
                    "normal_mean": feat.mean, "anomaly_mean": feat.anomaly_mean_value,
                    "deviation_pct": round(abs(feat.anomaly_mean_value - feat.mean) / max(abs(feat.mean), 1e-4) * 100, 1),
                })

        score_row = scores[scores["event_id"] == int(target_eid)]
        has_detection = bool(score_row.iloc[0]["has_detection"]) if not score_row.empty else False
        lead_time = float(score_row.iloc[0]["lead_time_hours"]) if not score_row.empty and pd.notna(score_row.iloc[0].get("lead_time_hours")) else None
        urgency = "HIGH" if has_detection and lead_time is not None and lead_time < 48 else ("MEDIUM" if has_detection else "LOW")

        primary = top_sensors[0]["description"].lower() if top_sensors else ""
        if "gearbox" in primary or "gear" in primary:
            actions = ["Sample gearbox oil for metal particle analysis", "Check gearbox oil temperature trend (past 30 days)", "Verify gearbox vibration levels vs baseline", "Schedule endoscopy inspection within 2 weeks"]
        elif "generator" in primary or "winding" in primary or "stator" in primary:
            actions = ["Measure generator winding resistance and insulation", "Inspect cooling system for blockages", "Check generator bearing condition and lubrication", "Review current/voltage imbalance logs"]
        elif "pitch" in primary or "blade" in primary:
            actions = ["Verify pitch angle calibration on all 3 blades", "Check pitch motor current vs baseline", "Inspect pitch bearing and lubrication", "Review pitch controller error logs"]
        elif "bearing" in primary:
            actions = ["Measure bearing temperature trend and vibration signature", "Check lubrication — grease quantity and condition", "Perform vibration envelope spectrum analysis", "Schedule replacement if vibration exceeds limit"]
        else:
            actions = [f"Investigate elevated readings: {top_sensors[0]['description'] if top_sensors else 'unknown'}", "Cross-reference with maintenance log", "Compare against turbine baseline period", "Schedule site inspection within 7 days"]

        return json.dumps({
            "work_order_id": f"WO-{asset_id:03d}-{int(target_eid):03d}",
            "generated_at": datetime.now(tz.utc).strftime("%Y-%m-%d %H:%M UTC"),
            "asset_id": asset_id, "event_id": int(target_eid),
            "fault_description": event_desc or "Anomaly detected by predictive model",
            "urgency": urgency,
            "has_model_detection": has_detection,
            "lead_time_hours": lead_time,
            "top_contributing_sensors": top_sensors,
            "recommended_actions": actions,
            "estimated_inspection_hours": 4 if urgency == "HIGH" else 2,
            "notes": f"Generated by Aeolus Isolation Forest. Lead time: {f'{lead_time:.0f}h advance warning' if lead_time else 'No detection'}.",
        })

    return json.dumps({"error": f"Unknown tool: {name}"})


class ChatRequest(BaseModel):
    message: str
    context: Optional[dict] = None


@router.post("/chat")
async def chat(payload: ChatRequest):
    if not settings.OPENROUTER_API_KEY:
        return JSONResponse({"error": "chat_not_configured"}, status_code=200)

    ctx_parts = []
    if payload.context:
        if payload.context.get("event_id"):
            ctx_parts.append(f"Operator is viewing Event #{payload.context['event_id']}")
        if payload.context.get("asset_id"):
            ctx_parts.append(f"Turbine/Asset #{payload.context['asset_id']} is in focus")
        if payload.context.get("selected_feature"):
            ctx_parts.append(f"Currently selected sensor: {payload.context['selected_feature']}")

    system = SYSTEM_PROMPT
    if ctx_parts:
        system += "\n\nUI context:\n" + "\n".join(ctx_parts)

    messages: list[dict] = [{"role": "user", "content": payload.message}]
    generated_work_order: Optional[dict] = None

    async with httpx.AsyncClient(timeout=60.0) as client:
        for _ in range(6):
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.OPENROUTER_MODEL,
                    "messages": [{"role": "system", "content": system}] + messages,
                    "tools": TOOLS,
                    "tool_choice": "auto",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            msg = data["choices"][0]["message"]

            if msg.get("tool_calls"):
                messages.append(msg)
                for tc in msg["tool_calls"]:
                    fn_name = tc["function"]["name"]
                    fn_args = json.loads(tc["function"]["arguments"] or "{}")
                    result = _execute_tool(fn_name, fn_args)
                    # Capture work orders so the frontend can render them as cards
                    if fn_name == "generate_work_order":
                        parsed = json.loads(result)
                        if "work_order_id" in parsed:
                            generated_work_order = parsed
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": result,
                    })
            else:
                out: dict = {"response": msg.get("content", "")}
                if generated_work_order:
                    out["work_order"] = generated_work_order
                return out

    return {"response": "Unable to complete after multiple tool calls."}
