"""
Turns raw output from weather_ai (in-process — real Open-Meteo forecasts +
real NCHMF landslide/flash-flood warnings, formerly a separate HTTP service)
into the stable shapes server.py serves to the frontend, with in-memory TTL
caching so the province-wide map and the chat/notification flows don't
hammer Open-Meteo, NCHMF or the LLM-backed advisory bulletin on every
request.

Three tiers of freshness, matching how expensive each source is:
- landslide snapshot (NCHMF, network call): refreshed every
  LANDSLIDE_CACHE_MINUTES, one call covers the whole province.
- per-commune weather (Open-Meteo, network call, no LLM): refreshed every
  WEATHER_CACHE_MINUTES, one call per commune.
- per-commune advisory (real LLM bulletin): refreshed every
  ADVISORY_CACHE_MINUTES, only ever generated for a commune someone actually
  looked at (never pre-warmed for all 45 — that would mean 45 LLM calls).
"""
import asyncio
import logging
import time
from datetime import date, datetime, timedelta

import communes
from core import config
from weather_ai.advisory import RISK_TITLES, build_advisory
from weather_ai.agent import AgentConfigurationError, WeatherAdvisoryAgent
from weather_ai.tools.common import DataSourceError

_log = logging.getLogger(__name__)

_agent = WeatherAdvisoryAgent()

RISK_SCALE = {
    0: {"level": 0, "label": "Bình thường", "color": "#2E7D32", "icon": "✅"},
    1: {"level": 1, "label": "Chú ý", "color": "#F9A825", "icon": "⚠️"},
    2: {"level": 2, "label": "Nguy hiểm", "color": "#EF6C00", "icon": "🟠"},
    3: {"level": 3, "label": "Rất nguy hiểm", "color": "#C62828", "icon": "🔴"},
}

_RISK_WORD_RANK = {
    "trung bình": 1,
    "cao": 2,
    "rất cao": 3,
}


def _rank_risk_word(value) -> int:
    if not value:
        return 0
    return _RISK_WORD_RANK.get(str(value).strip().casefold(), 0)


def _strip_prefix(name: str) -> str:
    for prefix in ("Xã ", "Phường ", "xã ", "phường "):
        if name.startswith(prefix):
            return name[len(prefix):]
    return name


def _normalize(name: str) -> str:
    return _strip_prefix(name).strip().casefold()


class _TTLCache:
    def __init__(self):
        self._store: dict[str, tuple[float, object]] = {}

    def get(self, key: str, ttl_seconds: float):
        entry = self._store.get(key)
        if not entry:
            return None
        fetched_at, value = entry
        if time.monotonic() - fetched_at > ttl_seconds:
            return None
        return value

    def set(self, key: str, value: object) -> None:
        self._store[key] = (time.monotonic(), value)


_weather_cache = _TTLCache()
_landslide_cache = _TTLCache()
_advisory_cache = _TTLCache()

_LANDSLIDE_KEY = "province"


async def _get_landslide_snapshot() -> dict:
    cached = _landslide_cache.get(_LANDSLIDE_KEY, config.LANDSLIDE_CACHE_MINUTES * 60)
    if cached is not None:
        return cached
    snapshot = await asyncio.to_thread(_agent.landslide_service.get_warnings, "")
    _landslide_cache.set(_LANDSLIDE_KEY, snapshot)
    return snapshot


def _landslide_lookup(snapshot: dict) -> dict[str, dict]:
    lookup: dict[str, dict] = {}
    for record in snapshot.get("warnings", []):
        for name in (record.get("commune"), record.get("former_commune")):
            if name:
                lookup[_normalize(name)] = record
    return lookup


def _find_landslide_record(lookup: dict[str, dict], commune_name: str) -> dict | None:
    key = _normalize(commune_name)
    if key in lookup:
        return lookup[key]
    for candidate_key, record in lookup.items():
        if key in candidate_key or candidate_key in key:
            return record
    return None


def _hazard_from_record(
    record: dict | None, field: str, requested_time: str | None, window_hours: int = 6
) -> dict | None:
    if not record:
        return None
    level = _rank_risk_word(record.get(field))
    if level == 0:
        return None
    valid_to = None
    if requested_time:
        try:
            valid_to = (datetime.fromisoformat(requested_time) + timedelta(hours=window_hours)).isoformat()
        except ValueError:
            valid_to = None
    return {
        "severity": RISK_SCALE[level],
        "valid_from": requested_time,
        "valid_to": valid_to,
        "official_warning": True,
    }


async def _get_weather(commune_id: str, days: int) -> dict:
    cached = _weather_cache.get(commune_id, config.WEATHER_CACHE_MINUTES * 60)
    cached_days = len(cached.get("forecast", {}).get("daily", [])) if cached else 0
    if cached is not None and cached_days >= days:
        return cached
    commune = communes.COMMUNES_BY_ID[commune_id]
    data = await asyncio.to_thread(
        _agent.weather_service.get_forecast, commune["name"], days, commune["lat"], commune["lon"]
    )
    _weather_cache.set(commune_id, data)
    return data


def _day_hazard_tags(day: dict) -> list[dict]:
    """Which weather-derived hazards fired for this day, with severity — the
    breakdown _day_weather_risk used to collapse straight into a single int,
    now kept so the frontend can render one icon card per active hazard type
    instead of only knowing the overall level."""
    tags: list[dict] = []

    rain = day.get("rain_sum_mm") or 0
    if rain >= 50:
        tags.append({"type": "heavy_rain", "title": RISK_TITLES["heavy_rain"], "severity": RISK_SCALE[3 if rain >= 100 else 2]})
    elif rain >= 25:
        tags.append({"type": "moderate_rain", "title": RISK_TITLES["moderate_rain"], "severity": RISK_SCALE[1]})

    temp_min = day.get("temperature_min_c")
    if temp_min is not None and temp_min <= 4:
        tags.append({"type": "frost", "title": RISK_TITLES["frost"], "severity": RISK_SCALE[3 if temp_min <= 1 else 2]})

    gust = day.get("wind_gust_max_kmh") or 0
    if gust >= 50:
        tags.append({"type": "strong_wind", "title": RISK_TITLES["strong_wind"], "severity": RISK_SCALE[3 if gust >= 75 else 2]})

    code = day.get("weather_code")
    if code in (96, 99):
        tags.append({"type": "thunderstorm_hail", "title": RISK_TITLES["thunderstorm_hail"], "severity": RISK_SCALE[3]})
    elif code == 95:
        tags.append({"type": "thunderstorm", "title": RISK_TITLES["thunderstorm"], "severity": RISK_SCALE[2]})

    return tags


def _day_weather_risk(day: dict) -> int:
    tags = _day_hazard_tags(day)
    return max((t["severity"]["level"] for t in tags), default=0)


def _build_day_entry(
    commune: dict,
    day: dict,
    day_index: int,
    landslide_record: dict | None,
    landslide_requested_time: str | None,
    landslide_window_hours: int = 6,
) -> dict:
    hazards = _day_hazard_tags(day)
    weather_level = max((t["severity"]["level"] for t in hazards), default=0)
    landslide = None
    flash_flood = None
    level = weather_level
    if day_index == 0 and landslide_record:
        landslide = _hazard_from_record(landslide_record, "landslide_risk", landslide_requested_time, landslide_window_hours)
        flash_flood = _hazard_from_record(landslide_record, "flash_flood_risk", landslide_requested_time, landslide_window_hours)
        level = max(
            level,
            landslide["severity"]["level"] if landslide else 0,
            flash_flood["severity"]["level"] if flash_flood else 0,
        )
    return {
        "commune_id": commune["id"],
        "name": commune["name"],
        "lat": commune["lat"],
        "lon": commune["lon"],
        "day_index": day_index,
        "date": day.get("date"),
        "condition": day.get("condition"),
        "icon": day.get("icon"),
        "icon_key": day.get("icon_key"),
        "weather_code": day.get("weather_code"),
        "temp_min_c": day.get("temperature_min_c"),
        "temp_max_c": day.get("temperature_max_c"),
        "rain_sum_mm": day.get("rain_sum_mm"),
        "rain_probability_max_percent": day.get("rain_probability_max_percent"),
        "wind_gust_max_kmh": day.get("wind_gust_max_kmh"),
        "sunrise": day.get("sunrise"),
        "sunset": day.get("sunset"),
        "risk": RISK_SCALE[level],
        "landslide": landslide,
        "flash_flood": flash_flood,
        "hazards": hazards,
        "confidence": day.get("confidence"),
    }


async def get_map_day(day_index: int) -> list[dict]:
    """One entry per commune for a given day (0 = today). Uses cached data only
    — never triggers a live fetch itself, see warm_caches() for that."""
    try:
        snapshot = await _get_landslide_snapshot()
    except DataSourceError as exc:
        _log.warning("landslide snapshot unavailable: %s", exc)
        snapshot = {"warnings": [], "requested_time": None}
    lookup = _landslide_lookup(snapshot)
    requested_time = snapshot.get("requested_time")
    window_hours = snapshot.get("forecast_window_hours", 6)

    out: list[dict] = []
    for commune in communes.COMMUNES:
        weather = _weather_cache.get(commune["id"], config.WEATHER_CACHE_MINUTES * 60)
        if weather is None:
            continue
        daily = weather.get("forecast", {}).get("daily", [])
        if day_index >= len(daily):
            continue
        record = _find_landslide_record(lookup, commune["name"])
        out.append(_build_day_entry(commune, daily[day_index], day_index, record, requested_time, window_hours))
    return out


async def get_commune_forecast(commune_id: str, days: int = config.FORECAST_DAYS) -> dict:
    """Rich single-commune view: real weather + real per-day-windowed hazards
    + a real LLM bulletin when LLM_API_KEY is configured. Falls back to the
    free weather+landslide combo (no bulletin) otherwise — always returns
    something, never raises for a known commune."""
    commune = communes.COMMUNES_BY_ID[commune_id]

    cached_advisory = _advisory_cache.get(commune_id, config.ADVISORY_CACHE_MINUTES * 60)
    cached_days = len(cached_advisory.get("forecast", [])) if cached_advisory else 0
    if cached_advisory is not None and cached_days >= days:
        return {
            **cached_advisory,
            "forecast": cached_advisory.get("forecast", [])[:days],
        }

    try:
        result = await asyncio.to_thread(_agent.run, commune["name"], None, days, commune["lat"], commune["lon"])
        payload = build_advisory(commune=result.commune, answer=result.answer, source_data=result.source_data)
        forecast = _from_advisory(commune, payload)
        _advisory_cache.set(commune_id, forecast)
        return forecast
    except AgentConfigurationError as exc:
        _log.info("advisory unavailable for %s (no LLM key), falling back: %s", commune["name"], exc)
    except (DataSourceError, ValueError) as exc:
        _log.warning("advisory data source failed for %s, falling back: %s", commune["name"], exc)
    except Exception as exc:
        _log.warning("advisory LLM call failed for %s, falling back: %s", commune["name"], exc)

    result = await _fallback_forecast(commune, days)
    _advisory_cache.set(commune_id, result)
    return result


def _from_advisory(commune: dict, payload: dict) -> dict:
    daily = [
        {
            "commune_id": commune["id"],
            "name": commune["name"],
            "lat": commune["lat"],
            "lon": commune["lon"],
            "day_index": index,
            "date": day.get("date"),
            "condition": day.get("condition"),
            "icon": day.get("icon"),
            "icon_key": day.get("icon_key"),
            "weather_code": day.get("weather_code"),
            "temp_min_c": day.get("temperature_min_c"),
            "temp_max_c": day.get("temperature_max_c"),
            "rain_sum_mm": day.get("rain_sum_mm"),
            "rain_probability_max_percent": day.get("rain_probability_max_percent"),
            "wind_gust_max_kmh": day.get("wind_gust_max_kmh"),
            "sunrise": day.get("sunrise"),
            "sunset": day.get("sunset"),
            "risk": _day_overall_risk(day, payload["overall_risk"] if index == 0 else None),
            "landslide": day.get("landslide"),
            "flash_flood": day.get("flash_flood"),
            "hazards": _day_hazard_tags(day),
            "confidence": day.get("confidence"),
        }
        for index, day in enumerate(payload.get("daily_forecast", []))
    ]
    return {
        "commune": commune,
        "overall_risk": payload["overall_risk"],
        "current": payload["current_weather"],
        "forecast": daily,
        "bulletin": {
            "language": payload["bulletin"]["language"],
            "title": payload["bulletin"]["title"],
            "text": payload["bulletin"]["llm_text"],
            "sms_text": payload["bulletin"]["channel_messages"]["sms"],
        },
        "language_support": payload["language_support"],
        "data_quality": payload["data_quality"],
        "data_sources": payload["data_sources"],
        "disclaimer": payload["disclaimer"],
        "source": "advisory",
    }


def _day_overall_risk(day: dict, fallback_overall: dict | None) -> dict:
    level = _day_weather_risk(
        {
            "rain_sum_mm": day.get("rain_sum_mm"),
            "temperature_min_c": day.get("temperature_min_c"),
            "wind_gust_max_kmh": day.get("wind_gust_max_kmh"),
            "weather_code": day.get("weather_code"),
        }
    )
    for hazard_key in ("landslide", "flash_flood"):
        hazard = day.get(hazard_key)
        if hazard and hazard.get("severity"):
            level = max(level, hazard["severity"]["level"])
    if fallback_overall:
        level = max(level, fallback_overall["level"])
    return RISK_SCALE[level]


async def _fallback_forecast(commune: dict, days: int) -> dict:
    weather = None
    try:
        weather = await _get_weather(commune["id"], days)
    except DataSourceError as exc:
        _log.warning("weather unavailable for %s: %s", commune["name"], exc)

    try:
        snapshot = await _get_landslide_snapshot()
    except DataSourceError:
        snapshot = {"warnings": [], "requested_time": None}
    lookup = _landslide_lookup(snapshot)
    record = _find_landslide_record(lookup, commune["name"])
    requested_time = snapshot.get("requested_time")
    window_hours = snapshot.get("forecast_window_hours", 6)

    if weather is None:
        return {
            "commune": commune,
            "overall_risk": RISK_SCALE[0],
            "current": None,
            "forecast": [],
            "bulletin": None,
            "language_support": {"available": ["vi"], "planned": ["thai", "hmong"], "translation_status": {}},
            "data_quality": {"status": "unavailable", "stale": True, "warnings": ["Không lấy được dữ liệu thời tiết."]},
            "data_sources": [],
            "disclaimer": "Chưa có dữ liệu.",
            "source": "unavailable",
        }

    forecast_data = weather["forecast"]
    daily = [
        _build_day_entry(commune, day, index, record if index == 0 else None, requested_time, window_hours)
        for index, day in enumerate(forecast_data.get("daily", [])[:days])
    ]
    overall_level = max((d["risk"]["level"] for d in daily), default=0)
    landslide_hazard = daily[0]["landslide"] if daily else None
    flash_flood_hazard = daily[0]["flash_flood"] if daily else None
    top_hazard_note = None
    if flash_flood_hazard:
        top_hazard_note = "Nguy cơ lũ quét theo cảnh báo NCHMF hiện tại."
    elif landslide_hazard:
        top_hazard_note = "Nguy cơ sạt lở đất theo cảnh báo NCHMF hiện tại."
    today = daily[0] if daily else None
    sms_text = (
        f"{RISK_SCALE[overall_level]['label']} - {commune['name']}. "
        + (top_hazard_note or (today["condition"] if today else "Chưa có dữ liệu."))
    )
    bulletin_text = (
        f"{commune['name']}: {today['condition'] if today else 'chưa rõ'}, "
        f"mưa khoảng {today['rain_sum_mm'] if today else 0}mm hôm nay. "
        + (top_hazard_note or "Chưa ghi nhận cảnh báo sạt lở/lũ quét chính thức tại thời điểm này.")
        + " (Bản tin tự động từ dữ liệu thô, chưa qua LLM vì chưa cấu hình LLM_API_KEY.)"
    )
    return {
        "commune": commune,
        "overall_risk": RISK_SCALE[overall_level],
        "current": forecast_data.get("current"),
        "forecast": daily,
        "bulletin": {
            "language": "vi",
            "title": f"Bản tin thời tiết {commune['name']}",
            "text": bulletin_text,
            "sms_text": sms_text,
        },
        "language_support": {
            "available": ["vi"],
            "planned": ["thai", "hmong"],
            "translation_status": {"vi": "ready", "thai": "not_implemented", "hmong": "not_implemented"},
        },
        "data_quality": {
            "status": "degraded",
            "stale": False,
            "warnings": ["Bản tin do hệ thống tự soạn từ dữ liệu thô — chưa cấu hình LLM_API_KEY hoặc lời gọi LLM lỗi."],
        },
        "data_sources": [
            {"id": "open_meteo", "name": "Open-Meteo Forecast", "url": weather.get("source"), "data_time": None, "official_warning_source": False},
            {"id": "nchmf_landslide", "name": "NCHMF - cảnh báo lũ quét, sạt lở đất", "url": snapshot.get("source"), "data_time": snapshot.get("fetched_at"), "official_warning_source": True},
        ],
        "disclaimer": "Tín hiệu thời tiết là sàng lọc tự động, không thay thế bản tin chuyên môn hay cảnh báo chính quyền.",
        "source": "fallback",
    }


async def warm_caches(days: int = config.FORECAST_DAYS, concurrency: int = 4) -> None:
    """Refreshes the landslide snapshot and every commune's weather. Cheap
    (no LLM); safe to run on a timer. Does NOT touch the advisory cache."""
    try:
        await _get_landslide_snapshot()
    except DataSourceError as exc:
        _log.warning("could not warm landslide snapshot (NCHMF unreachable?): %s", exc)

    semaphore = asyncio.Semaphore(concurrency)

    async def _refresh_one(commune_id: str):
        async with semaphore:
            try:
                await _get_weather(commune_id, days)
            except DataSourceError as exc:
                _log.warning("could not warm weather for %s: %s", commune_id, exc)

    await asyncio.gather(*(_refresh_one(c["id"]) for c in communes.COMMUNES))
    _log.info("Forecast cache warmed for %d communes", len(communes.COMMUNES))


def top_risk_communes(day_index: int = 0, limit: int = 5) -> list[dict]:
    """Synchronous — reads whatever is already cached, does not fetch."""
    cached_entries = []
    for commune in communes.COMMUNES:
        weather = _weather_cache.get(commune["id"], config.WEATHER_CACHE_MINUTES * 60)
        if weather is None:
            continue
        daily = weather.get("forecast", {}).get("daily", [])
        if day_index >= len(daily):
            continue
        cached_entries.append((commune, daily[day_index]))

    snapshot = _landslide_cache.get(_LANDSLIDE_KEY, config.LANDSLIDE_CACHE_MINUTES * 60) or {"warnings": []}
    lookup = _landslide_lookup(snapshot)
    requested_time = snapshot.get("requested_time")
    window_hours = snapshot.get("forecast_window_hours", 6)

    entries = [
        _build_day_entry(commune, day, day_index, _find_landslide_record(lookup, commune["name"]), requested_time, window_hours)
        for commune, day in cached_entries
    ]
    entries.sort(key=lambda e: e["risk"]["level"], reverse=True)
    return entries[:limit]


def date_for_day(day_index: int) -> str:
    return (date.today() + timedelta(days=day_index)).strftime("%d/%m/%Y")
