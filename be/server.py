"""
Trạm Bản — single backend process.

Everything lives here now: commune registry, real forecast/risk data (via
weather_ai — in-process Open-Meteo + NCHMF + LLM bulletin, copied from the
teammate's fe/ai prototype and adapted to the shared LLM provider), the
grounded chat/voice endpoints (via chat — copied from the standalone
chatbot_agent_voice project), and the scheduled daily notification
broadcast. The only process that stays separate is the Kaggle model server
(src/backend/kaggle/kaggle_server.py) — it needs a Kaggle GPU notebook and
can't run locally.
"""
import asyncio
import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import communes
import config
import db
import forecast_service
import geo_utils
import llm_notify
from chat import llm as chat_llm
from chat.model_client import model_client
from chat.routers import chat as chat_router, voice as voice_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s", datefmt="%H:%M:%S")
_log = logging.getLogger("server")

scheduler = AsyncIOScheduler()


async def _synthesize_hmong(text: str) -> str | None:
    try:
        result = await model_client.synthesize(text, "hmong")
        return f"data:audio/wav;base64,{result['audio']}"
    except Exception as exc:
        _log.warning("Hmong TTS unavailable (Kaggle server not running / KAGGLE_NGROK_URL not set?): %s", exc)
    return None


def _dominant_hazard_type(row: dict) -> str | None:
    """Which single hazard a notification's 'xem chi tiết' link should jump
    to — official NCHMF warnings outrank model-derived weather signals."""
    if row.get("landslide"):
        return "landslide"
    if row.get("flash_flood"):
        return "flash_flood"
    hazards = row.get("hazards") or []
    top = max(hazards, key=lambda h: h["severity"]["level"], default=None)
    return top["type"] if top else None


def _serialize_alert(row: dict) -> dict:
    return {**row, "audio_language": "hmong"}


async def _create_alert_for_commune(
    commune_id: str, commune_name: str, risk: dict, hazards_row: dict, *, status: str, sent_by: str | None,
) -> dict | None:
    """Builds and persists one alert, applying BR02/BR03 dedup+escalation
    (db.should_create_alert) so re-running the scan doesn't spam duplicates."""
    hazard_type = _dominant_hazard_type(hazards_row)
    date = forecast_service.date_for_day(0)
    if not db.should_create_alert(commune_id, date, risk["level"], hazard_type):
        return None
    detail = await forecast_service.get_commune_forecast(commune_id)
    bulletin = detail["bulletin"] or {"sms_text": f"{risk['label']} - {commune_name}.", "text": ""}
    hmong_text = await asyncio.to_thread(llm_notify.translate_to_hmong_tts, bulletin["sms_text"])
    audio_url = await _synthesize_hmong(hmong_text)
    alert = db.create_alert(
        commune_id=commune_id,
        commune_name=commune_name,
        date=date,
        risk_level=risk["level"],
        risk_label=risk["label"],
        risk_color=risk["color"],
        hazard_type=hazard_type,
        message_vi=bulletin["sms_text"],
        hmong_tts_text=hmong_text,
        audio_url=audio_url,
        status=status,
        sent_by=sent_by,
    )
    return alert


async def run_notification_cycle() -> list[dict]:
    """Auto-broadcast scan: only risk level 3 (Rất nguy hiểm) communes are
    sent without an official's approval — everything below that is left for
    an official to send manually via POST /api/officer/alerts/{commune_id}/send.

    Bulletin lookup runs concurrently (cached per commune already, so this is
    cheap unless the cache just expired). TTS synthesis runs sequentially
    afterwards: the Kaggle model server holds a single GPU lock for Hmong TTS,
    and firing several requests at once against it (through the localtunnel
    proxy) was observed to 500 rather than queue.
    """
    all_ranked = forecast_service.top_risk_communes(day_index=0, limit=len(communes.COMMUNES))
    critical = [row for row in all_ranked if row["risk"]["level"] >= 3]

    created: list[dict] = []
    for row in critical:
        alert = await _create_alert_for_commune(
            row["commune_id"], row["name"], row["risk"], row, status="auto", sent_by=None,
        )
        if alert:
            created.append(alert)
    _log.info("Notification cycle produced %d items (%d level-3 communes scanned)", len(created), len(critical))
    return created


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    await model_client.warmup()

    _log.info("Warming forecast cache (Open-Meteo + NCHMF) ...")
    await forecast_service.warm_caches()

    scheduler.add_job(
        run_notification_cycle,
        trigger=CronTrigger(hour=config.NOTIFY_HOUR, minute=config.NOTIFY_MINUTE),
        id="daily_notify",
        replace_existing=True,
    )
    scheduler.add_job(
        forecast_service.warm_caches,
        trigger=IntervalTrigger(minutes=config.WEATHER_CACHE_MINUTES),
        id="warm_forecast_cache",
        replace_existing=True,
    )
    scheduler.start()
    _log.info("Scheduler started: daily notifications at %02d:%02d, cache warm every %d min",
              config.NOTIFY_HOUR, config.NOTIFY_MINUTE, config.WEATHER_CACHE_MINUTES)
    yield
    scheduler.shutdown(wait=False)
    await model_client.close()


app = FastAPI(title="Trạm Bản API", version="0.3.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router.router)
app.include_router(voice_router.router)


class TTSRequest(BaseModel):
    text: str
    language: str


class ResidentRegisterRequest(BaseModel):
    phone: str
    password: str
    display_name: str
    commune_id: str


class LoginRequest(BaseModel):
    phone: str
    password: str


class ResidentUpdateRequest(BaseModel):
    display_name: str
    commune_id: str


class OfficialRegisterRequest(BaseModel):
    phone: str
    password: str
    display_name: str
    commune_id: str


class AlertViewRequest(BaseModel):
    resident_id: str


def _public_account(row: dict) -> dict:
    """Strip password hash/salt before this ever reaches a response body."""
    return {k: v for k, v in row.items() if k not in ("password_hash", "password_salt")}


@app.get("/health")
async def health():
    kaggle_ok = False
    try:
        result = await model_client.health()
        kaggle_ok = result.get("status") == "ok"
    except Exception:
        kaggle_ok = False
    return {
        "status": "ok",
        "communes": len(communes.COMMUNES),
        "llm_provider": config.LLM_PROVIDER,
        "llm_configured": bool(config.LLM_API_KEY),
        "kaggle_server": kaggle_ok,
    }


@app.post("/tts")
async def synthesize_text(request: TTSRequest):
    if request.language not in {"hmong", "vietnamese"}:
        raise HTTPException(status_code=400, detail="Language must be 'hmong' or 'vietnamese'")
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")
    clean_text = chat_llm.preprocess_for_tts(request.text)
    try:
        result = await model_client.synthesize(clean_text or request.text[:400], request.language)
        return {"audio": result["audio"]}
    except Exception:
        raise HTTPException(status_code=503, detail="TTS service unavailable")


@app.get("/api/communes")
async def list_communes():
    return {"default_commune_id": config.DEFAULT_COMMUNE_ID, "communes": communes.COMMUNES}


@app.get("/api/communes/{commune_id}")
async def get_commune(commune_id: str):
    commune = communes.COMMUNES_BY_ID.get(commune_id)
    if not commune:
        raise HTTPException(status_code=404, detail="Commune not found")
    return commune


@app.get("/api/geo/province")
async def geo_province():
    import json
    with open(communes.DATA_DIR / "dienbien_province.geojson", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/geo/communes")
async def geo_communes():
    import json
    with open(communes.DATA_DIR / "dienbien_communes.geojson", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/forecast/map")
async def get_forecast_map(day: int = 0):
    day = max(0, min(day, config.FORECAST_DAYS - 1))
    entries = await forecast_service.get_map_day(day)
    return {"day_index": day, "date": forecast_service.date_for_day(day), "communes": entries}


@app.get("/api/forecast/{commune_id}")
async def get_forecast(commune_id: str, days: int = config.FORECAST_DAYS):
    if commune_id not in communes.COMMUNES_BY_ID:
        raise HTTPException(status_code=404, detail="Commune not found")
    days = max(1, min(days, 7))
    return await forecast_service.get_commune_forecast(commune_id, days)


@app.get("/api/risk/{commune_id}")
async def get_risk(commune_id: str):
    if commune_id not in communes.COMMUNES_BY_ID:
        raise HTTPException(status_code=404, detail="Commune not found")
    detail = await forecast_service.get_commune_forecast(commune_id, 1)
    today = detail["forecast"][0] if detail["forecast"] else None
    return {"commune_id": commune_id, "overall_risk": detail["overall_risk"], "today": today}


@app.get("/api/warnings/{commune_id}/latest")
async def get_warning(commune_id: str):
    commune = communes.COMMUNES_BY_ID.get(commune_id)
    if not commune:
        raise HTTPException(status_code=404, detail="Commune not found")
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


@app.post("/api/residents/register")
async def register_resident(request: ResidentRegisterRequest):
    commune = communes.COMMUNES_BY_ID.get(request.commune_id)
    if not commune:
        raise HTTPException(status_code=404, detail="Commune not found")
    if db.get_resident_by_phone(request.phone):
        raise HTTPException(status_code=409, detail="Phone already registered")
    if len(request.password) < 6:
        raise HTTPException(status_code=422, detail="Password must be at least 6 characters")
    lat, lon = geo_utils.random_point_in_commune(request.commune_id, commune["lat"], commune["lon"])
    resident = db.create_resident(request.phone, request.password, request.display_name, request.commune_id, lat, lon)
    return _public_account(resident)


@app.get("/api/residents/{resident_id}")
async def get_resident(resident_id: str):
    resident = db.get_resident(resident_id)
    if not resident:
        raise HTTPException(status_code=404, detail="Resident not found")
    return _public_account(resident)


@app.post("/api/residents/login")
async def login_resident(request: LoginRequest):
    resident = db.authenticate_resident(request.phone, request.password)
    if not resident:
        raise HTTPException(status_code=401, detail="Sai số điện thoại hoặc mật khẩu")
    return _public_account(resident)


@app.patch("/api/residents/{resident_id}")
async def update_resident_profile(resident_id: str, request: ResidentUpdateRequest):
    existing = db.get_resident(resident_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Resident not found")
    commune = communes.COMMUNES_BY_ID.get(request.commune_id)
    if not commune:
        raise HTTPException(status_code=404, detail="Commune not found")
    if existing["commune_id"] != request.commune_id:
        lat, lon = geo_utils.random_point_in_commune(request.commune_id, commune["lat"], commune["lon"])
    else:
        lat, lon = existing["lat"], existing["lon"]
    updated = db.update_resident(resident_id, request.display_name, request.commune_id, lat, lon)
    return _public_account(updated)


@app.post("/api/officials/register")
async def register_official(request: OfficialRegisterRequest):
    if request.commune_id not in communes.COMMUNES_BY_ID:
        raise HTTPException(status_code=404, detail="Commune not found")
    if db.get_official_by_phone(request.phone):
        raise HTTPException(status_code=409, detail="Phone already registered")
    if len(request.password) < 6:
        raise HTTPException(status_code=422, detail="Password must be at least 6 characters")
    official = db.create_official(request.phone, request.password, request.display_name, request.commune_id)
    return _public_account(official)


@app.get("/api/officials/{official_id}")
async def get_official(official_id: str):
    official = db.get_official(official_id)
    if not official:
        raise HTTPException(status_code=404, detail="Official not found")
    return _public_account(official)


@app.post("/api/officials/login")
async def login_official(request: LoginRequest):
    official = db.authenticate_official(request.phone, request.password)
    if not official:
        raise HTTPException(status_code=401, detail="Sai số điện thoại hoặc mật khẩu")
    return _public_account(official)


@app.get("/api/chat/history/{resident_id}")
async def chat_history(resident_id: str):
    if not db.get_resident(resident_id):
        raise HTTPException(status_code=404, detail="Resident not found")
    return db.get_chat_history(resident_id)


@app.get("/api/notifications")
async def list_notifications(limit: int = 20):
    # Deliberately does not auto-generate on first call — bulletin lookup +
    # TTS can be slow enough to block the page load. The scheduler fills this
    # daily; use POST /api/notifications/generate to fill it on demand.
    return [_serialize_alert(a) for a in db.list_alerts(limit)]


@app.post("/api/notifications/generate")
async def trigger_notifications():
    created = await run_notification_cycle()
    return {"created": len(created), "items": [_serialize_alert(a) for a in created]}


@app.post("/api/alerts/{alert_id}/view")
async def view_alert(alert_id: str, request: AlertViewRequest):
    if not db.get_alert(alert_id):
        raise HTTPException(status_code=404, detail="Alert not found")
    if not db.get_resident(request.resident_id):
        raise HTTPException(status_code=404, detail="Resident not found")
    db.mark_alert_viewed(request.resident_id, alert_id)
    return {"ok": True}


@app.get("/api/officer/alerts")
async def officer_alerts(commune_id: str):
    if commune_id not in communes.COMMUNES_BY_ID:
        raise HTTPException(status_code=404, detail="Commune not found")
    return [_serialize_alert(a) for a in db.list_alerts_by_commune(commune_id)]


@app.get("/api/officer/viewed-map")
async def officer_viewed_map(alert_id: str):
    result = db.viewed_map_for_alert(alert_id)
    if not result:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"alert": _serialize_alert(result["alert"]), "residents": result["residents"]}


@app.post("/api/officer/alerts/{commune_id}/send")
async def officer_send_alert(commune_id: str, official_id: str | None = None):
    commune = communes.COMMUNES_BY_ID.get(commune_id)
    if not commune:
        raise HTTPException(status_code=404, detail="Commune not found")
    if official_id and not db.get_official(official_id):
        raise HTTPException(status_code=404, detail="Official not found")
    detail = await forecast_service.get_commune_forecast(commune_id, 1)
    today = detail["forecast"][0] if detail["forecast"] else None
    risk = today["risk"] if today else detail["overall_risk"]
    alert = await _create_alert_for_commune(
        commune_id, commune["name"], risk, today or {}, status="officer", sent_by=official_id,
    )
    if not alert:
        raise HTTPException(status_code=409, detail="No change since the last alert for this commune today")
    return _serialize_alert(alert)


@app.get("/api/admin/notify-config")
async def notify_config():
    return {"hour": config.NOTIFY_HOUR, "minute": config.NOTIFY_MINUTE, "note": "set via NOTIFY_HOUR/NOTIFY_MINUTE in src/backend/.env, restart to apply"}


@app.get("/api/chat/context/{commune_id}")
async def chat_context(commune_id: str):
    """Grounding bundle the frontend passes into a new chatbot session."""
    if commune_id not in communes.COMMUNES_BY_ID:
        raise HTTPException(status_code=404, detail="Commune not found")
    return await forecast_service.get_commune_forecast(commune_id)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
