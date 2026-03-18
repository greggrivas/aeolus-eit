from __future__ import annotations

from fastapi import APIRouter

from ..schemas.care import PredictionRequest, PredictionResult
from ..services.model_service import predict_single

router = APIRouter(prefix="/api", tags=["predict"])


@router.post("/predict", response_model=PredictionResult)
def predict(payload: PredictionRequest):
    return predict_single(payload.features)
