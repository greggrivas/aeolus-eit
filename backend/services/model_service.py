from __future__ import annotations

import numpy as np

from ..startup import get_state
from ..schemas.care import PredictionResult


def predict_single(features: dict[str, float]) -> PredictionResult:
    state = get_state()
    feature_cols = state.model_metadata["feature_cols"]
    threshold = state.model_metadata["threshold"]

    # Build feature vector
    X = np.array([[features.get(col, 0.0) for col in feature_cols]], dtype=float)
    X_scaled = state.scaler.transform(X)
    score = float(state.model.score_samples(X_scaled)[0])
    is_anomaly = score < threshold

    return PredictionResult(
        anomaly_score=round(score, 6),
        is_anomaly=is_anomaly,
        threshold=round(threshold, 6),
        features_used=len(feature_cols),
    )
