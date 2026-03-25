from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import joblib
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.preprocessing import StandardScaler

from .core.config import settings


@dataclass
class AeolusState:
    events_catalog: pd.DataFrame = field(default_factory=pd.DataFrame)
    event_data: dict[str, pd.DataFrame] = field(default_factory=dict)
    scores_summary: pd.DataFrame = field(default_factory=pd.DataFrame)
    overall_care: dict = field(default_factory=dict)
    model: Optional[IsolationForest] = None
    scaler: Optional[StandardScaler] = None
    model_metadata: dict = field(default_factory=dict)
    feature_description: pd.DataFrame = field(default_factory=pd.DataFrame)
    fault_predictions: dict = field(default_factory=dict)
    power_curve: dict = field(default_factory=dict)
    rf_model: Optional[RandomForestClassifier] = None
    rf_metadata: dict = field(default_factory=dict)
    artifacts_loaded: bool = False


_state: AeolusState = AeolusState()


def get_state() -> AeolusState:
    return _state


def load_artifacts() -> None:
    global _state

    data_dir: Path = settings.DATA_DIR
    models_dir: Path = settings.MODELS_DIR
    raw_dir: Path = settings.RAW_DATA_DIR

    # Load catalog
    _state.events_catalog = pd.read_parquet(data_dir / "events_catalog.parquet")

    # Load all event parquets into memory
    _state.event_data = {}
    for parquet_path in sorted(data_dir.glob("event_*.parquet")):
        event_id = parquet_path.stem.replace("event_", "")
        _state.event_data[event_id] = pd.read_parquet(parquet_path)

    # Load scores
    _state.scores_summary = pd.read_parquet(data_dir / "scores_summary.parquet")

    with open(data_dir / "overall_care.json") as f:
        _state.overall_care = json.load(f)

    # Load model artifacts
    _state.model = joblib.load(models_dir / "isolation_forest.joblib")
    _state.scaler = joblib.load(models_dir / "scaler.joblib")

    with open(models_dir / "model_metadata.json") as f:
        _state.model_metadata = json.load(f)

    # Load feature descriptions
    fd_path = raw_dir / "feature_description.csv"
    if fd_path.exists():
        _state.feature_description = pd.read_csv(fd_path, sep=";")

    # Optional: supervised Random Forest (from 05_supervised.py)
    rf_path = models_dir / "random_forest.joblib"
    if rf_path.exists():
        _state.rf_model = joblib.load(rf_path)
    rf_meta_path = models_dir / "rf_metadata.json"
    if rf_meta_path.exists():
        with open(rf_meta_path) as f:
            _state.rf_metadata = json.load(f)

    # Optional: fault predictions (from 04_fit_extras.py)
    fp_path = data_dir / "fault_predictions.json"
    if fp_path.exists():
        with open(fp_path) as f:
            _state.fault_predictions = json.load(f)

    # Optional: power curve model (from 04_fit_extras.py)
    pc_path = models_dir / "power_curve.joblib"
    if pc_path.exists():
        _state.power_curve = joblib.load(pc_path)

    _state.artifacts_loaded = True
    print(f"[startup] Loaded {len(_state.event_data)} events, model threshold={_state.model_metadata.get('threshold', 'N/A'):.4f}")
