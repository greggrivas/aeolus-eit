from __future__ import annotations

from fastapi import APIRouter

from ..startup import get_state

router = APIRouter(prefix="/api/model", tags=["model"])


@router.get("/info")
def get_model_info():
    state = get_state()
    meta = dict(state.model_metadata)
    feature_count = len(meta.pop("feature_cols", []))
    meta["feature_count"] = feature_count

    result = {"isolation_forest": meta}

    if state.rf_metadata:
        rf = dict(state.rf_metadata)
        rf.pop("feature_cols", None)
        result["random_forest"] = rf

    return result
