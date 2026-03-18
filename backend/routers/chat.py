from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import httpx

from ..core.config import settings

router = APIRouter(prefix="/api", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    context: Optional[dict] = None


@router.post("/chat")
async def chat(payload: ChatRequest):
    if not settings.OPENROUTER_API_KEY:
        return JSONResponse({"error": "chat_not_configured"}, status_code=200)

    # Build context string
    ctx_parts = []
    if payload.context:
        if payload.context.get("event_id"):
            ctx_parts.append(f"Event ID: {payload.context['event_id']}")
        if payload.context.get("event_label"):
            ctx_parts.append(f"Event label: {payload.context['event_label']}")
        if payload.context.get("care_scores"):
            ctx_parts.append(f"CARE scores: {payload.context['care_scores']}")
        if payload.context.get("selected_feature"):
            ctx_parts.append(f"Selected sensor: {payload.context['selected_feature']}")

    system_msg = (
        "You are an assistant for a wind turbine predictive maintenance dashboard. "
        "Answer questions about anomaly detection results and CARE metrics. "
        "Be concise and technical."
    )
    if ctx_parts:
        system_msg += "\n\nCurrent context:\n" + "\n".join(ctx_parts)

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.OPENROUTER_MODEL,
                "messages": [
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": payload.message},
                ],
            },
        )
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        return {"response": content}
