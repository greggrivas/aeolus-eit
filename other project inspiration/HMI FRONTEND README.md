# Gas Turbine Digital Twin HMI

Last updated: 2026-02-23

Frontend HMI for the AIS4004 marine gas turbine digital twin project. This app visualizes current condition, decay predictions, maintenance guidance, and contextual chat support.

## Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- React Query
- Zustand
- OpenRouter-backed assistant

## Current UI Behavior

### Header

- Main title: **HMI by IndustryStandard™**
- Subtitle: **Gas Turbine Digital Twin**
- `Assistant` label appears next to the chat icon only while chat is open.

### Engine Visualization (M501J 360)

- Uses local frame sequence in `public/m501j360/clean/img_01.png` to `img_24.png`.
- Manual slider control for rotation.
- Default frame is side-oriented.
- No auto-spin.
- Supporting asset folders retained:
  - `public/m501j360/raw`
  - `public/m501j360/clean`
  - `public/m501j360/original`

### 3D Degradation Surface

- Interactive projected surface with hover details for Kmt, Kmc, fuel flow, and T48.
- Axis orientation tuned for operator readability.
- Text placement aligned with the `3D Degradation Surface` section header.

### Status and Recommendation Cards

- TIC is included in ship status metrics.
- Top action/priority/maintenance card keeps neutral outer background for all priorities.
- Priority naming now matches health bands: `healthy`, `warning`, `critical`.
- Top card shows:
  - `Predicted Time to Maintenance Compressor` (units)
  - `Predicted Time to Maintenance Turbine` (units)

### Linear RUL Cards

- Two bottom charts are shown:
  - Compressor Remaining Useful Life Projection
  - Turbine Remaining Useful Life Projection
- Both charts show:
  - current decay point
  - threshold line
  - projected crossing point (`RUL ≈ N units`)

### Chat Assistant

- Chat tool traces are hidden from UI.
- Tool outputs are summarized by a post-tool model call into plain language.
- Context is loaded from `data/assistant_context.md`.
- If summarization fails, deterministic fallback summary is used.

## API Integration

The frontend uses internal Next.js API routes in `app/api/**`, which proxy to the FastAPI backend (`FASTAPI_BASE_URL`).

Main routes used by UI:

- `/api/hmi/bootstrap`
- `/api/hmi/snapshot`
- `/api/hmi/surface-data`
- `/api/hmi/surface-marker`
- `/api/hmi/rul-prediction`
- `/api/chat`

## Local Setup

### 1) Start backend

```bash
cd "/Users/nicolas/Documents/Vibes/00_School/Digital_Twins-Boatface"
uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

### 2) Install frontend dependencies

```bash
cd "/Users/nicolas/Documents/Vibes/00_School/Digital_Twins-Boatface/stitch 2/hmi-app"
npm install
```

### 3) Create env file

Create `stitch 2/hmi-app/.env.local`:

```env
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=meta-llama/llama-3.1-70b-instruct
FASTAPI_BASE_URL=http://127.0.0.1:8000
```

### 4) Run app

```bash
npm run dev
```

Open `http://127.0.0.1:3000/hmi/maintenance-center`.

## Notes

- This HMI is part of an academic project.
- Current snapshot values are sampled from the 20% holdout split and are not live telemetry.
- RUL values are reported in dataset time-index units.
