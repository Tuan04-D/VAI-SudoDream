"""Public forecast, risk and warning endpoints."""

from fastapi import APIRouter, HTTPException

import communes
import forecast_service
from core import config


router = APIRouter(prefix="/api", tags=["forecast"])


def _require_commune(commune_id: str) -> dict:
    commune = communes.COMMUNES_BY_ID.get(commune_id)
    if not commune:
        raise HTTPException(status_code=404, detail="Commune not found")
    return commune


@router.get("/forecast/map")
async def forecast_map(day: int = 0):
    day = max(0, min(day, config.FORECAST_DAYS - 1))
    entries = await forecast_service.get_map_day(day)
    return {"day_index": day, "date": forecast_service.date_for_day(day), "communes": entries}


@router.get("/forecast/{commune_id}")
async def forecast(commune_id: str, days: int = config.FORECAST_DAYS):
    _require_commune(commune_id)
    return await forecast_service.get_commune_forecast(commune_id, max(1, min(days, 7)))


@router.get("/risk/{commune_id}")
async def risk(commune_id: str):
    _require_commune(commune_id)
    detail = await forecast_service.get_commune_forecast(commune_id, 1)
    today = detail["forecast"][0] if detail["forecast"] else None
    return {"commune_id": commune_id, "overall_risk": detail["overall_risk"], "today": today}


@router.get("/warnings/{commune_id}/latest")
async def latest_warning(commune_id: str):
    commune = _require_commune(commune_id)
    detail = await forecast_service.get_commune_forecast(commune_id)
    return {
        "commune_id": commune_id,
        "commune_name": commune["name"],
        "date": forecast_service.date_for_day(0),
        "overall_risk": detail["overall_risk"],
        "bulletin": detail["bulletin"],
        "data_quality": detail["data_quality"],
        "disclaimer": detail["disclaimer"],
        "source": detail["source"],
    }


@router.get("/chat/context/{commune_id}")
async def chat_context(commune_id: str):
    _require_commune(commune_id)
    return await forecast_service.get_commune_forecast(commune_id)
