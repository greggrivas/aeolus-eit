from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..services.data_service import list_events, get_event, get_timeseries, get_features, get_event_attribution, get_subsystem_signals, get_power_curve_scatter
from ..schemas.event import EventSummary, EventDetail, TimeseriesResponse, FeatureInfo, EventAttribution, PowerCurveResponse
from ..schemas.subsystem import SubsystemSignalsResponse

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("", response_model=list[EventSummary])
def get_events(label_filter: str = Query(default="all", description="all | anomaly | normal")):
    return list_events(label_filter)


@router.get("/{event_id}", response_model=EventDetail)
def get_event_detail(event_id: str):
    event = get_event(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")
    return event


@router.get("/{event_id}/timeseries", response_model=TimeseriesResponse)
def get_event_timeseries(
    event_id: str,
    feature: str = Query(default="power_30_avg", description="Sensor column name"),
    downsample: int = Query(default=500, ge=10, le=10000),
):
    result = get_timeseries(event_id, feature, downsample)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")
    return result


@router.get("/{event_id}/features", response_model=list[FeatureInfo])
def get_event_features(event_id: str):
    features = get_features(event_id)
    if not features:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")
    return features


@router.get("/{event_id}/attribution", response_model=EventAttribution)
def get_attribution(event_id: str):
    result = get_event_attribution(event_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")
    return result


@router.get("/{event_id}/power-curve", response_model=PowerCurveResponse)
def get_power_curve(event_id: str):
    result = get_power_curve_scatter(event_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")
    return result


@router.get("/{event_id}/subsystems", response_model=SubsystemSignalsResponse)
def get_subsystems(event_id: str):
    result = get_subsystem_signals(event_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")
    return result
