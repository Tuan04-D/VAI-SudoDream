"""
Main backend ("server chung") for Trạm Bản.

Owns: commune registry, mock forecast/risk data, grounded warning text,
scheduled daily notification broadcast. Talks to the chatbot backend
(src/backend/chatbot_agent_voice, port 8001) only for TTS when building
notification audio — the chatbot's own chat/voice endpoints are called
directly by the frontend for latency, not proxied through here.

Forecast numbers are MOCK data — see mock_forecast.py docstring.
"""
import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import config
import llm_notify
import mock_forecast

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s", datefmt="%H:%M:%S")
_log = logging.getLogger("server")

_http = httpx.AsyncClient(timeout=httpx.Timeout(connect=5.0, read=30.0, write=10.0, pool=5.0))

# In-memory notification feed — resets on restart. No DB in this slice by design
# (see NOTES.md); swap for a real table (see WARNINGS/DELIVERY_LOGS in the
# architecture doc) without changing the API shape.
_notifications: list[dict] = []
_warning_cache: dict[str, dict] = {}

scheduler = AsyncIOScheduler()


async def _synthesize_hmong(text: str) -> str | None:
    try:
        resp = await _http.post(f"{config.CHATBOT_API_BASE}/tts", json={"text": text, "language": "hmong"})
        if resp.is_success:
            data = resp.json()
            return f"data:audio/wav;base64,{data['audio']}"
    except Exception as exc:
        _log.warning("TTS unavailable (chatbot backend / kaggle server not running?): %s", exc)
    return None


def _date_for_day(day_index: int) -> str:
    return (date.today() + timedelta(days=day_index)).strftime("%d/%m/%Y")


async def _build_notification_text(row: dict, date_str: str) -> dict:
    commune_name = row["name"]
    texts = await asyncio.to_thread(llm_notify.generate_notification_texts, commune_name, row, date_str)
    return {
        "id": f"{row['commune_id']}-{date.today().isoformat()}",
        "commune_id": row["commune_id"],
        "commune_name": commune_name,
        "date": date_str,
        "risk_level": row["risk_level"],
        "hazard_type": row["hazard_type"],
        "hazard_label": row["hazard_label"],
        "message_vi": texts["vi_short"],
        "hmong_tts_text": texts["hmong_tts_text"],
        "audio_url": None,
        "audio_language": "hmong",
        "created_at": datetime.utcnow().isoformat(),
    }


async def run_notification_cycle(max_communes: int = 5) -> list[dict]:
    """Generates the daily broadcast: default commune + top at-risk communes for day 1.

    Text generation (DeepSeek) runs concurrently — that's cheap and stateless.
    TTS synthesis runs sequentially afterwards: the Kaggle model server holds a
    single GPU lock for Hmong TTS, and firing several requests at once against
    it (through the localtunnel proxy) was observed to 500 rather than queue.
    """
    top = mock_forecast.top_risk_communes(day=1, limit=max_communes)
    ids = {c["commune_id"] for c in top}
    if config.DEFAULT_COMMUNE_ID not in ids:
        default = mock_forecast.COMMUNES_BY_ID.get(config.DEFAULT_COMMUNE_ID)
        if default:
            top = [{"commune_id": default["id"], "name": default["name"],
                     **mock_forecast._day_values(default, 1)}] + top[:max_communes - 1]

    date_str = _date_for_day(1)
    created = await asyncio.gather(*(_build_notification_text(row, date_str) for row in top))
    for item in created:
        item["audio_url"] = await _synthesize_hmong(item["hmong_tts_text"])
    for item in created:
        _notifications.insert(0, item)
    del _notifications[200:]
    _log.info("Notification cycle produced %d items", len(created))
    return list(created)


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(
        run_notification_cycle,
        trigger=CronTrigger(hour=config.NOTIFY_HOUR, minute=config.NOTIFY_MINUTE),
        id="daily_notify",
        replace_existing=True,
    )
    scheduler.start()
    _log.info("Scheduler started: daily notifications at %02d:%02d", config.NOTIFY_HOUR, config.NOTIFY_MINUTE)
    yield
    scheduler.shutdown(wait=False)
    await _http.aclose()


app = FastAPI(title="Trạm Bản API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "communes": len(mock_forecast.COMMUNES)}


@app.get("/api/communes")
async def list_communes():
    return {"default_commune_id": config.DEFAULT_COMMUNE_ID, "communes": mock_forecast.COMMUNES}


@app.get("/api/communes/{commune_id}")
async def get_commune(commune_id: str):
    commune = mock_forecast.COMMUNES_BY_ID.get(commune_id)
    if not commune:
        raise HTTPException(status_code=404, detail="Commune not found")
    return commune


@app.get("/api/geo/province")
async def geo_province():
    import json
    with open(mock_forecast.DATA_DIR / "dienbien_province.geojson", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/geo/communes")
async def geo_communes():
    import json
    with open(mock_forecast.DATA_DIR / "dienbien_communes.geojson", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/forecast/map")
async def get_forecast_map(day: int = 1):
    day = max(1, min(day, 5))
    date_str = _date_for_day(day)
    communes = mock_forecast.generate_map_day(day)
    for row in communes:
        row["date"] = date_str
    return {"day_index": day, "date": date_str, "communes": communes}


@app.get("/api/forecast/{commune_id}")
async def get_forecast(commune_id: str, days: int = 5):
    if commune_id not in mock_forecast.COMMUNES_BY_ID:
        raise HTTPException(status_code=404, detail="Commune not found")
    commune = mock_forecast.COMMUNES_BY_ID[commune_id]
    days = max(1, min(days, 5))
    forecast = mock_forecast.generate_forecast(commune_id, days)
    for row in forecast:
        row["date"] = _date_for_day(row["day_index"])
    return {"commune": commune, "forecast": forecast}


@app.get("/api/risk/{commune_id}")
async def get_risk(commune_id: str):
    if commune_id not in mock_forecast.COMMUNES_BY_ID:
        raise HTTPException(status_code=404, detail="Commune not found")
    forecast = mock_forecast.generate_forecast(commune_id, 1)
    return {"commune_id": commune_id, "date": _date_for_day(1), **forecast[0]}


@app.get("/api/warnings/{commune_id}/latest")
async def get_warning(commune_id: str, day: int = 1):
    commune = mock_forecast.COMMUNES_BY_ID.get(commune_id)
    if not commune:
        raise HTTPException(status_code=404, detail="Commune not found")
    day = max(1, min(day, 5))
    cache_key = f"{commune_id}:{day}"
    if cache_key in _warning_cache:
        return _warning_cache[cache_key]

    day_data = mock_forecast.generate_forecast(commune_id, day)[-1]
    date_str = _date_for_day(day)
    text = llm_notify.generate_warning_text(commune["name"], day_data, date_str)
    result = {
        "commune_id": commune_id,
        "commune_name": commune["name"],
        "date": date_str,
        "day_index": day,
        "warning_text_vi": text,
        **day_data,
    }
    _warning_cache[cache_key] = result
    return result


@app.get("/api/notifications")
async def list_notifications(limit: int = 20):
    # Deliberately does not auto-generate on first call — LLM+TTS calls are
    # slow enough that this would block the page load. The scheduler fills
    # this daily; use POST /api/notifications/generate to fill it on demand.
    return _notifications[:limit]


@app.post("/api/notifications/generate")
async def trigger_notifications():
    created = await run_notification_cycle()
    return {"created": len(created), "items": created}


@app.get("/api/admin/notify-config")
async def notify_config():
    return {"hour": config.NOTIFY_HOUR, "minute": config.NOTIFY_MINUTE, "note": "set via NOTIFY_HOUR/NOTIFY_MINUTE in src/backend/.env, restart to apply"}


@app.get("/api/chat/context/{commune_id}")
async def chat_context(commune_id: str):
    """Grounding bundle the frontend passes into a new chatbot session."""
    commune = mock_forecast.COMMUNES_BY_ID.get(commune_id)
    if not commune:
        raise HTTPException(status_code=404, detail="Commune not found")
    forecast = mock_forecast.generate_forecast(commune_id, 5)
    for row in forecast:
        row["date"] = _date_for_day(row["day_index"])
    return {"commune": commune, "forecast": forecast}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
