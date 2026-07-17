from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from .agent import AgentConfigurationError, DienBienWeatherAgent
from .config import get_settings
from .tools.common import DataSourceError


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()
agent = DienBienWeatherAgent(settings=settings)


def refresh_landslide_cache() -> None:
    try:
        result = agent.landslide_service.refresh(force=True)
        logger.info(
            "Da cap nhat cache sat lo: %s ban ghi Dien Bien", len(result.get("records", []))
        )
    except Exception:
        logger.exception("Khong cap nhat duoc cache sat lo; se giu cache cu neu co")


@asynccontextmanager
async def lifespan(_: FastAPI):
    scheduler = BackgroundScheduler(timezone="Asia/Ho_Chi_Minh")
    scheduler.add_job(
        refresh_landslide_cache,
        "interval",
        hours=settings.landslide_refresh_hours,
        next_run_time=datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")),
        id="refresh-landslide-dien-bien",
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(
    title="Điện Biên Weather & Landslide AI",
    version="0.1.0",
    lifespan=lifespan,
)


class AdvisoryRequest(BaseModel):
    commune: str = Field(min_length=2, examples=["Tủa Chùa"])
    question: str | None = None
    days: int = Field(default=3, ge=1, le=7)
    latitude: float | None = None
    longitude: float | None = None


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "openai_key_configured": bool(settings.openai_api_key),
        "landslide_refresh_hours": settings.landslide_refresh_hours,
    }


@app.post("/api/v1/advisories")
def create_advisory(request: AdvisoryRequest) -> dict[str, Any]:
    try:
        result = agent.run(
            commune=request.commune,
            question=request.question,
            days=request.days,
            latitude=request.latitude,
            longitude=request.longitude,
        )
        return {
            "answer": result.answer,
            "commune": result.commune,
            "model": result.model,
            "tool_trace": result.tool_trace,
            "source_data": result.source_data,
        }
    except AgentConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (DataSourceError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        # Khong ghi exception message cua SDK: mot so provider co the chen
        # thong tin xac thuc vao message, lam ro ri secret vao log/API response.
        logger.error("Agent gap loi: %s", type(exc).__name__)
        raise HTTPException(
            status_code=502,
            detail="Agent không gọi được mô hình. Kiểm tra OPENAI_API_KEY và OPENAI_MODEL.",
        ) from exc


@app.get("/api/v1/landslides")
def get_landslides(commune: str = Query(default="")) -> dict[str, Any]:
    try:
        return agent.landslide_service.get_warnings(commune)
    except DataSourceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/api/v1/landslides/refresh")
def refresh_landslides() -> dict[str, Any]:
    try:
        result = agent.landslide_service.refresh(force=True)
        return {
            "status": "ok",
            "records": len(result.get("records", [])),
            "fetched_at": result.get("fetched_at"),
            "cache_status": result.get("cache_status"),
        }
    except DataSourceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/v1/weather")
def get_weather(
    commune: str,
    days: int = Query(default=3, ge=1, le=7),
    latitude: float | None = None,
    longitude: float | None = None,
) -> dict[str, Any]:
    try:
        return agent.weather_service.get_forecast(
            commune, days, latitude, longitude
        )
    except (DataSourceError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
