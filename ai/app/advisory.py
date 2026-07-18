from __future__ import annotations

import hashlib
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from .tools.common import normalize_text, utc_now_iso


RISK_SCALE = {
    0: {"level": 0, "label": "Bình thường", "color": "#2E7D32", "icon": "✅"},
    1: {"level": 1, "label": "Chú ý", "color": "#F9A825", "icon": "⚠️"},
    2: {"level": 2, "label": "Nguy hiểm", "color": "#EF6C00", "icon": "🟠"},
    3: {"level": 3, "label": "Rất nguy hiểm", "color": "#C62828", "icon": "🔴"},
}

RISK_TITLES = {
    "heavy_rain": "Mưa lớn",
    "moderate_rain": "Mưa cần chú ý",
    "frost": "Rét đậm, nguy cơ sương giá",
    "fog": "Sương mù, tầm nhìn hạn chế",
    "strong_wind": "Gió mạnh",
    "thunderstorm": "Dông",
    "thunderstorm_hail": "Dông kèm mưa đá",
    "landslide": "Nguy cơ sạt lở đất",
    "flash_flood": "Nguy cơ lũ quét",
}


def _source(source_data: dict[str, Any], primary: str, fallback: str) -> dict[str, Any]:
    value = source_data.get(primary) or source_data.get(fallback) or {}
    return value if isinstance(value, dict) else {}


def _risk_level(value: Any) -> int:
    return {
        "trung binh": 1,
        "cao": 2,
        "rat cao": 3,
    }.get(normalize_text(value), 0)


def _risk_item(
    risk_type: str,
    severity: int,
) -> dict[str, Any]:
    return {
        "type": risk_type,
        "title": RISK_TITLES[risk_type],
        "severity": RISK_SCALE[min(max(severity, 0), 3)],
    }


def _parse_source_time(value: Any) -> datetime | None:
    if not value:
        return None
    text = str(value).strip()
    dotnet_match = re.fullmatch(r"/Date\((\d+)\)/", text)
    if dotnet_match:
        return datetime.fromtimestamp(
            int(dotnet_match.group(1)) / 1000, tz=timezone.utc
        )
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _daily_hazard(
    risk: dict[str, Any] | None,
    *,
    valid_from: datetime | None,
    valid_to: datetime | None,
) -> dict[str, Any] | None:
    if not risk or not valid_from or not valid_to:
        return None
    return {
        "severity": risk["severity"],
        "valid_from": valid_from.isoformat(),
        "valid_to": valid_to.isoformat(),
        "official_warning": True,
    }


def _attach_official_hazards(
    daily: list[dict[str, Any]],
    landslide: dict[str, Any],
    risks: list[dict[str, Any]],
    timezone_name: str,
) -> list[dict[str, Any]]:
    """Attach the 6-hour NCHMF warning only to overlapping forecast dates."""
    warnings = landslide.get("warnings", [])
    warnings = warnings if isinstance(warnings, list) else []
    valid_from = _parse_source_time(landslide.get("requested_time"))
    if valid_from is None and warnings:
        valid_from = _parse_source_time(warnings[0].get("source_time"))
    window_hours = int(landslide.get("forecast_window_hours") or 6)
    valid_to = valid_from + timedelta(hours=window_hours) if valid_from else None
    risk_by_type = {item["type"]: item for item in risks}

    try:
        local_timezone = ZoneInfo(timezone_name)
    except Exception:
        local_timezone = ZoneInfo("Asia/Ho_Chi_Minh")

    result: list[dict[str, Any]] = []
    for source_day in daily:
        item = dict(source_day)
        day_text = item.get("date")
        overlaps = False
        if day_text and valid_from and valid_to:
            try:
                day_start = datetime.fromisoformat(str(day_text)).replace(
                    tzinfo=local_timezone
                )
                day_end = day_start + timedelta(days=1)
                local_from = valid_from.astimezone(local_timezone)
                local_to = valid_to.astimezone(local_timezone)
                overlaps = local_from < day_end and local_to > day_start
            except ValueError:
                overlaps = False
        item["landslide"] = (
            _daily_hazard(
                risk_by_type.get("landslide"),
                valid_from=valid_from,
                valid_to=valid_to,
            )
            if overlaps
            else None
        )
        item["flash_flood"] = (
            _daily_hazard(
                risk_by_type.get("flash_flood"),
                valid_from=valid_from,
                valid_to=valid_to,
            )
            if overlaps
            else None
        )
        result.append(item)
    return result


def build_advisory(
    *, commune: str, answer: str, source_data: dict[str, Any]
) -> dict[str, Any]:
    """Build the stable frontend contract from tool data, never from LLM prose."""
    weather = _source(source_data, "get_weather_forecast", "weather")
    landslide = _source(source_data, "get_landslide_warnings", "landslide")
    forecast = weather.get("forecast", {}) if isinstance(weather.get("forecast"), dict) else {}
    location = weather.get("location", {}) if isinstance(weather.get("location"), dict) else {}

    risks: list[dict[str, Any]] = []
    for signal in forecast.get("signals", []):
        risk_type = signal.get("type")
        if risk_type in RISK_TITLES:
            risks.append(
                _risk_item(
                    risk_type,
                    int(signal.get("severity", 0)),
                )
            )

    warnings = landslide.get("warnings", []) if isinstance(landslide.get("warnings"), list) else []
    for hazard, source_key in (("landslide", "landslide_risk"), ("flash_flood", "flash_flood_risk")):
        level = max((_risk_level(item.get(source_key)) for item in warnings), default=0)
        if level:
            risks.append(_risk_item(hazard, level))

    overall_level = max(
        [int(item["severity"]["level"]) for item in risks]
        + [int(forecast.get("risk_scale", {}).get("level", 0))],
        default=0,
    )
    current = forecast.get("current", {}) if isinstance(forecast.get("current"), dict) else {}
    daily = forecast.get("daily", []) if isinstance(forecast.get("daily"), list) else []
    periods = forecast.get("six_hour_periods", []) if isinstance(forecast.get("six_hour_periods"), list) else []
    timezone_name = forecast.get("model_timezone") or "Asia/Ho_Chi_Minh"
    daily = _attach_official_hazards(daily, landslide, risks, timezone_name)
    issued_at = forecast.get("generated_at") or utc_now_iso()
    valid_to = periods[-1].get("to") if periods else (daily[-1].get("date") if daily else None)
    top_risk = max(risks, key=lambda item: item["severity"]["level"], default=None)
    short_message = (
        f"{RISK_SCALE[overall_level]['icon']} {RISK_SCALE[overall_level]['label']} - {commune}. "
        + (f"{top_risk['title']}." if top_risk else "Chưa có tín hiệu nguy hiểm nổi bật.")
    )
    stale = bool(landslide.get("stale", False))
    quality_warnings: list[str] = []
    if stale:
        quality_warnings.append("Dữ liệu NCHMF đang dùng cache cũ do nguồn tạm thời không truy cập được.")
    if commune and not warnings:
        quality_warnings.append(
            "Không tìm thấy địa điểm trong danh sách cảnh báo NCHMF hiện tại; không đồng nghĩa an toàn tuyệt đối."
        )
    if not weather:
        quality_warnings.append("Không có dữ liệu dự báo thời tiết có cấu trúc.")

    advisory_id = hashlib.sha1(
        f"{commune}|{issued_at}|{overall_level}".encode("utf-8")
    ).hexdigest()[:16]
    return {
        "id": advisory_id,
        "overall_risk": RISK_SCALE[overall_level],
        "location": {
            "commune": commune,
            "province": "Điện Biên",
            "display_name": location.get("display_name") or f"{commune}, Điện Biên",
            "latitude": location.get("latitude"),
            "longitude": location.get("longitude"),
            "granularity": "point" if location.get("latitude") is not None else "commune",
            "resolver": location.get("resolver"),
        },
        "validity": {
            "issued_at": issued_at,
            "valid_from": current.get("time"),
            "valid_to": valid_to,
            "timezone": timezone_name,
        },
        "current_weather": current,
        "daily_forecast": daily,
        "six_hour_forecast": periods,
        "bulletin": {
            "language": "vi",
            "title": f"Bản tin thời tiết {commune}",
            "llm_text": answer,
            "channel_messages": {
                "app": answer,
                "zalo": answer,
                "sms": short_message,
                "loudspeaker": answer,
            },
            "translations": {"vi": answer, "thai": None, "hmong": None},
        },
        "language_support": {
            "available": ["vi"],
            "planned": ["thai", "hmong"],
            "translation_status": {
                "vi": "ready",
                "thai": "not_implemented",
                "hmong": "not_implemented",
            },
        },
        "data_sources": [
            {
                "id": "open_meteo",
                "name": "Open-Meteo Forecast",
                "url": weather.get("source"),
                "data_time": issued_at,
                "official_warning_source": False,
            },
            {
                "id": "nchmf_landslide",
                "name": "NCHMF - cảnh báo lũ quét, sạt lở đất",
                "url": landslide.get("source"),
                "data_time": landslide.get("fetched_at") or landslide.get("requested_time"),
                "official_warning_source": True,
            },
        ],
        "data_quality": {
            "status": "degraded" if quality_warnings else "good",
            "stale": stale,
            "warnings": quality_warnings,
        },
        "disclaimer": (
            "Tín hiệu thời tiết là kết quả sàng lọc từ dự báo mô hình. "
            "Chỉ mục NCHMF mới là nguồn cảnh báo chuyên ngành trong dữ liệu này; "
            "luôn đối chiếu thông báo của chính quyền và quan sát tại chỗ."
        ),
    }
