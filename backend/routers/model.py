from __future__ import annotations

from fastapi import APIRouter

from ..startup import get_state

router = APIRouter(prefix="/api/model", tags=["model"])


@router.get("/info")
def get_model_info():
    state = get_state()
    meta = dict(state.model_metadata)
    # Don't return the full feature list in info endpoint (too large)
    feature_count = len(meta.pop("feature_cols", []))
    meta["feature_count"] = feature_count
    return meta
