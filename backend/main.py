from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .startup import load_artifacts, get_state
from .routers import events, scores, predict, model, chat, simulate


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_artifacts()
    yield


app = FastAPI(
    title="Aeolus — Wind Turbine Predictive Maintenance API",
    version="1.0.0",
    description="Backend API for Wind Farm A anomaly detection and CARE benchmark results.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events.router)
app.include_router(scores.router)
app.include_router(predict.router)
app.include_router(model.router)
app.include_router(chat.router)
app.include_router(simulate.router)


@app.get("/health")
def health():
    state = get_state()
    return {
        "status": "ok",
        "artifacts_loaded": state.artifacts_loaded,
        "events_loaded": len(state.event_data),
    }
