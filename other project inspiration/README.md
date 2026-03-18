# AIS4004 Gas Turbine Digital Twin

Last updated: 2026-02-23

This repository contains the full school project for condition-based monitoring of a marine gas turbine digital twin:

- Python FastAPI backend for prediction, maintenance logic, and HMI endpoints
- Next.js HMI frontend with dashboard, chat assistant, and M501J 360 viewer
- Data and EDA artifacts for report support

## Repository Layout

```text
.
├── Data/                    # Dataset + EDA/report artifacts
├── src/                     # FastAPI app + model/service logic
├── stitch 2/hmi-app/        # Next.js HMI app
├── README_API.md            # Backend endpoint reference
├── openapi.json             # OpenAPI export
└── requirements.txt         # Python dependencies
```

## Tech Stack

- Frontend: Next.js 14, React 18, TypeScript
- UI and styling: Tailwind CSS, clsx, class-variance-authority, tailwind-merge, lucide-react
- Frontend state/data: Zustand, @tanstack/react-query
- Frontend API layer: Next.js Route Handlers (`/api/...`)
- Chat orchestration: OpenAI SDK against OpenRouter
- Backend API: FastAPI, Uvicorn, Pydantic
- Data/ML runtime: pandas, numpy, scikit-learn
- ML models in production backend: SVR (RBF) for compressor decay, Random Forest for turbine decay
- Data storage: Local CSV dataset + local JSONL chat history/context files

## Quick Start

### 1) Backend (FastAPI)

```bash
cd "/Users/nicolas/Documents/Vibes/00_School/Digital_Twins-Boatface"
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

Backend docs:

- Swagger: `http://127.0.0.1:8000/docs`
- OpenAPI JSON: `http://127.0.0.1:8000/openapi.json`

### 2) Frontend (HMI)

```bash
cd "/Users/nicolas/Documents/Vibes/00_School/Digital_Twins-Boatface/stitch 2/hmi-app"
npm install
```

Create `stitch 2/hmi-app/.env.local`:

```env
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=meta-llama/llama-3.1-70b-instruct
FASTAPI_BASE_URL=http://127.0.0.1:8000
```

Then run:

```bash
npm run dev
```

HMI URL: `http://127.0.0.1:3000/hmi/maintenance-center`

## Current Implemented Features

- Header branding: **HMI by IndustryStandard™** + subtitle **Gas Turbine Digital Twin**
- M501J 360 viewer using local frame sequence:
  - `stitch 2/hmi-app/public/m501j360/raw`
  - `stitch 2/hmi-app/public/m501j360/clean`
  - `stitch 2/hmi-app/public/m501j360/original`
- Slider-based manual rotation, default side frame, no auto-spin
- Interactive 3D degradation surface with hover values
- Predicted-vs-actual decay error display for compressor and turbine
- Linear RUL projections for compressor and turbine, shown in dataset units
- Top recommendation card aligned with health state naming:
  - `healthy`, `warning`, `critical`
- Chat assistant with context-aware tool usage and post-tool summarization
  - Tool traces hidden in chat UI

## Data/Model Notes

- Snapshot values are sampled from the **20% holdout split** (not used for training), then decay is predicted.
- Compressor decay model: **SVR (RBF)**
- Turbine decay model: **Random Forest**
- Snapshot should be treated as simulated operational state, not live vessel telemetry.

## Notes

- Academic project for AIS4004.
- TIC is a control command (%), not fuel mass flow.
- `Fuel_Flow` is actual fuel rate in kg/s.
