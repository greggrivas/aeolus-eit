# Naval Propulsion Condition Monitoring API

Last updated: 2026-02-23

FastAPI backend for prediction, diagnostics, maintenance recommendation, and HMI data delivery.

## Run

```bash
cd "/Users/nicolas/Documents/Vibes/00_School/Digital_Twins-Boatface"
python3 -m pip install -r requirements.txt
uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

## API Docs

- OpenAPI JSON: `http://127.0.0.1:8000/openapi.json`
- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

## Endpoints

### Core Health + Prediction

- `GET /health`
- `POST /predict/decay`
- `POST /predict/decay-from-sensors`
- `POST /analyze/sensors`
- `GET /dataset/summary`
- `GET /correlations/physical`
- `POST /maintenance/recommend`
- `POST /tools/compare-operating-conditions`

### HMI Endpoints

- `GET /hmi/snapshot`
- `GET /hmi/surface-data?speed=<int>`
- `POST /hmi/surface-marker`
- `POST /hmi/rul-prediction`

## Important Data Semantics

- `GET /hmi/snapshot` is sourced from a fixed 20% holdout split row of the project CSV and then enriched with model predictions.
- It should be treated as a simulated operating snapshot, not direct live telemetry.
- `TIC` is turbine injection control command (%), while `Fuel_Flow` is actual fuel mass flow (kg/s).
- Maintenance priority labels are aligned to health bands: `healthy`, `warning`, `critical`.
- RUL output is reported in dataset time-index units (not direct clock hours).

## Model Notes

- Compressor decay prediction uses **SVR (RBF)**.
- Turbine decay prediction uses **Random Forest**.
