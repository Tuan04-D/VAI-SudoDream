from __future__ import annotations

from collections import Counter
import logging
import statistics
import threading
import time
from typing import Any

from .common import DataSourceError, normalize_text, request_json, utc_now_iso
from .landslide import LandslideService


GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

_log = logging.getLogger(__name__)

# A second, best-effort Open-Meteo query compares three global numerical
# weather models. Their disagreement is exposed as an uncertainty signal; it
# never replaces the primary forecast and must never make that request fail.
ENSEMBLE_MODELS = ["ecmwf_ifs025", "gfs_seamless", "icon_seamless"]
_ENSEMBLE_PRECIP_FLOOR_MM = 5.0
_ENSEMBLE_TEMP_FLOOR_C = 2.0
CONFIDENCE_LEVELS = [
    (0.75, "high", "Tin cậy cao"),
    (0.45, "medium", "Tin cậy trung bình"),
    (0.0, "low", "Cần theo dõi thêm"),
]


def _confidence_from_relative_spread(relative_spread: float) -> tuple[str, str]:
    score = max(0.0, min(1.0, 1.0 - relative_spread))
    for threshold, level, label in CONFIDENCE_LEVELS:
        if score >= threshold:
            return level, label
    return CONFIDENCE_LEVELS[-1][1], CONFIDENCE_LEVELS[-1][2]


def _day_ensemble_confidence(
    precip_values: list[float], temp_max_values: list[float]
) -> dict[str, Any] | None:
    """Score one day from ECMWF/GFS/ICON disagreement.

    The lower confidence of precipitation and maximum temperature wins so the
    UI does not overstate certainty when either hazard-relevant variable has a
    wide model spread.
    """
    if len(precip_values) < 2 and len(temp_max_values) < 2:
        return None

    spread_precip = statistics.pstdev(precip_values) if len(precip_values) >= 2 else None
    spread_temp = statistics.pstdev(temp_max_values) if len(temp_max_values) >= 2 else None

    relative_spreads: list[float] = []
    if spread_precip is not None:
        mean_precip = statistics.fmean(precip_values)
        relative_spreads.append(spread_precip / max(mean_precip, _ENSEMBLE_PRECIP_FLOOR_MM))
    if spread_temp is not None:
        relative_spreads.append(spread_temp / _ENSEMBLE_TEMP_FLOOR_C)

    worst_spread = max(relative_spreads)
    score = max(0.0, min(1.0, 1.0 - worst_spread))
    level, label = _confidence_from_relative_spread(worst_spread)
    return {
        "score": round(score, 2),
        "level": level,
        "label": label,
        "spread_precip_mm": round(spread_precip, 1) if spread_precip is not None else None,
        "spread_temp_c": round(spread_temp, 1) if spread_temp is not None else None,
        "models": ENSEMBLE_MODELS,
    }


def _ensemble_daily_confidence(
    ensemble_payload: dict[str, Any], days: int
) -> list[dict[str, Any] | None]:
    daily = ensemble_payload.get("daily", {}) if isinstance(ensemble_payload, dict) else {}
    if not isinstance(daily, dict):
        return [None] * days

    result: list[dict[str, Any] | None] = []
    for index in range(days):
        precip_values: list[float] = []
        temp_max_values: list[float] = []
        for model in ENSEMBLE_MODELS:
            precip_series = daily.get(f"precipitation_sum_{model}")
            temp_series = daily.get(f"temperature_2m_max_{model}")
            if isinstance(precip_series, list) and index < len(precip_series) and precip_series[index] is not None:
                precip_values.append(_number(precip_series[index]))
            if isinstance(temp_series, list) and index < len(temp_series) and temp_series[index] is not None:
                temp_max_values.append(_number(temp_series[index]))
        result.append(_day_ensemble_confidence(precip_values, temp_max_values))
    return result

WEATHER_CODES = {
    0: "Trời quang",
    1: "Ít mây",
    2: "Có mây",
    3: "Nhiều mây",
    45: "Sương mù",
    48: "Sương mù đóng băng",
    51: "Mưa phùn nhẹ",
    53: "Mưa phùn",
    55: "Mưa phùn dày",
    61: "Mưa nhẹ",
    63: "Mưa vừa",
    65: "Mưa to",
    71: "Tuyết nhẹ",
    73: "Tuyết vừa",
    75: "Tuyết dày",
    80: "Mưa rào nhẹ",
    81: "Mưa rào",
    82: "Mưa rào rất mạnh",
    95: "Dông",
    96: "Dông kèm mưa đá",
    99: "Dông mạnh kèm mưa đá",
}


def weather_condition_ui(code: int) -> dict[str, str]:
    """Return stable presentation metadata so clients do not parse Vietnamese text."""
    if code == 0:
        return {"icon_key": "clear", "icon": "☀️"}
    if code in {1, 2}:
        return {"icon_key": "partly_cloudy", "icon": "⛅"}
    if code == 3:
        return {"icon_key": "cloudy", "icon": "☁️"}
    if code in {45, 48}:
        return {"icon_key": "fog", "icon": "🌫️"}
    if code in {51, 53, 55, 61, 63, 80, 81}:
        return {"icon_key": "rain", "icon": "🌧️"}
    if code in {65, 82}:
        return {"icon_key": "heavy_rain", "icon": "🌧️"}
    if code in {71, 73, 75}:
        return {"icon_key": "snow", "icon": "🌨️"}
    if code == 95:
        return {"icon_key": "thunderstorm", "icon": "⛈️"}
    if code in {96, 99}:
        return {"icon_key": "hail", "icon": "⛈️"}
    return {"icon_key": "unknown", "icon": "❓"}


def _values(payload: dict[str, Any], section: str, key: str) -> list[Any]:
    value = payload.get(section, {}).get(key, [])
    return value if isinstance(value, list) else []


def _number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value) if value is not None else default
    except (TypeError, ValueError):
        return default


def summarize_forecast(
    payload: dict[str, Any],
    days: int,
    ensemble_confidence: list[dict[str, Any] | None] | None = None,
) -> dict[str, Any]:
    times = _values(payload, "hourly", "time")[: days * 24]
    temperature = _values(payload, "hourly", "temperature_2m")
    apparent_temperature = _values(payload, "hourly", "apparent_temperature")
    precipitation = _values(payload, "hourly", "precipitation")
    probability = _values(payload, "hourly", "precipitation_probability")
    humidity = _values(payload, "hourly", "relative_humidity_2m")
    visibility = _values(payload, "hourly", "visibility")
    wind_speed = _values(payload, "hourly", "wind_speed_10m")
    wind_direction = _values(payload, "hourly", "wind_direction_10m")
    gusts = _values(payload, "hourly", "wind_gusts_10m")
    codes = _values(payload, "hourly", "weather_code")

    periods: list[dict[str, Any]] = []
    for start in range(0, len(times), 6):
        end = min(start + 6, len(times))
        temp_slice = [_number(v) for v in temperature[start:end]]
        apparent_slice = [_number(v) for v in apparent_temperature[start:end]]
        rain_slice = [_number(v) for v in precipitation[start:end]]
        prob_slice = [_number(v) for v in probability[start:end]]
        humidity_slice = [_number(v) for v in humidity[start:end]]
        visibility_slice = [_number(v) for v in visibility[start:end]]
        wind_speed_slice = [_number(v) for v in wind_speed[start:end]]
        wind_direction_slice = [_number(v) for v in wind_direction[start:end]]
        gust_slice = [_number(v) for v in gusts[start:end]]
        code_slice = [int(_number(v)) for v in codes[start:end]]
        if not temp_slice:
            continue
        dominant_code = Counter(code_slice).most_common(1)[0][0] if code_slice else 0
        strongest_wind_index = (
            wind_speed_slice.index(max(wind_speed_slice)) if wind_speed_slice else None
        )
        periods.append(
            {
                "from": times[start],
                "to": times[end - 1],
                "weather_code": dominant_code,
                "condition": WEATHER_CODES.get(dominant_code, f"Mã WMO {dominant_code}"),
                **weather_condition_ui(dominant_code),
                "temperature_min_c": round(min(temp_slice), 1),
                "temperature_max_c": round(max(temp_slice), 1),
                "apparent_temperature_min_c": round(min(apparent_slice), 1)
                if apparent_slice
                else None,
                "apparent_temperature_max_c": round(max(apparent_slice), 1)
                if apparent_slice
                else None,
                "rain_mm": round(sum(rain_slice), 1),
                "rain_probability_max_percent": round(max(prob_slice), 0)
                if prob_slice
                else None,
                "humidity_max_percent": round(max(humidity_slice), 0)
                if humidity_slice
                else None,
                "visibility_min_m": round(min(visibility_slice), 0)
                if visibility_slice
                else None,
                "wind_speed_max_kmh": round(max(wind_speed_slice), 1)
                if wind_speed_slice
                else None,
                "wind_direction_at_max_deg": round(
                    wind_direction_slice[strongest_wind_index], 0
                )
                if strongest_wind_index is not None
                and strongest_wind_index < len(wind_direction_slice)
                else None,
                "wind_gust_max_kmh": round(max(gust_slice), 1) if gust_slice else None,
            }
        )

    daily_times = _values(payload, "daily", "time")[:days]
    daily: list[dict[str, Any]] = []
    for index, day in enumerate(daily_times):
        def at(key: str) -> Any:
            sequence = _values(payload, "daily", key)
            return sequence[index] if index < len(sequence) else None

        code = int(_number(at("weather_code")))
        daily.append(
            {
                "date": day,
                "weather_code": code,
                "condition": WEATHER_CODES.get(code, f"Mã WMO {code}"),
                **weather_condition_ui(code),
                "temperature_min_c": at("temperature_2m_min"),
                "temperature_max_c": at("temperature_2m_max"),
                "apparent_temperature_min_c": at("apparent_temperature_min"),
                "apparent_temperature_max_c": at("apparent_temperature_max"),
                "rain_sum_mm": at("precipitation_sum"),
                "rain_hours": at("precipitation_hours"),
                "rain_probability_max_percent": at("precipitation_probability_max"),
                "wind_gust_max_kmh": at("wind_gusts_10m_max"),
                "sunrise": at("sunrise"),
                "sunset": at("sunset"),
                "confidence": ensemble_confidence[index]
                if ensemble_confidence and index < len(ensemble_confidence)
                else None,
            }
        )

    signals: list[dict[str, Any]] = []
    max_period_rain = max((_number(item["rain_mm"]) for item in periods), default=0)
    max_daily_rain = max((_number(item["rain_sum_mm"]) for item in daily), default=0)
    min_temperature = min(
        (_number(item["temperature_min_c"], 99) for item in daily), default=99
    )
    max_gust = max(
        (_number(item["wind_gust_max_kmh"]) for item in daily), default=0
    )
    fog_periods = [
        item
        for item in periods
        if item["icon_key"] == "fog"
        or (
            item.get("visibility_min_m") is not None
            and item["visibility_min_m"] <= 1000
        )
    ]
    storm_codes = [code for code in codes[: days * 24] if int(_number(code)) >= 95]

    if max_period_rain >= 30 or max_daily_rain >= 50:
        signals.append(
            {
                "type": "heavy_rain",
                "severity": 3 if max_daily_rain >= 100 else 2,
                "evidence": f"Mưa lớn nhất 6h {max_period_rain:.1f} mm; ngày {max_daily_rain:.1f} mm",
            }
        )
    elif max_period_rain >= 15 or max_daily_rain >= 25:
        signals.append(
            {
                "type": "moderate_rain",
                "severity": 1,
                "evidence": f"Mưa lớn nhất 6h {max_period_rain:.1f} mm; ngày {max_daily_rain:.1f} mm",
            }
        )
    if min_temperature <= 4:
        signals.append(
            {
                "type": "frost",
                "severity": 3 if min_temperature <= 1 else 2,
                "evidence": f"Nhiệt độ thấp nhất {min_temperature:.1f}°C",
            }
        )
    if fog_periods:
        minimum_visibility = min(
            (
                _number(item.get("visibility_min_m"), 1001)
                for item in fog_periods
            ),
            default=1001,
        )
        signals.append(
            {
                "type": "fog",
                "severity": 2 if minimum_visibility <= 500 else 1,
                "evidence": (
                    f"Có tín hiệu sương mù từ {fog_periods[0]['from']}; "
                    f"tầm nhìn thấp nhất {minimum_visibility:.0f} m"
                    if minimum_visibility <= 1000
                    else f"Có tín hiệu sương mù từ {fog_periods[0]['from']}"
                ),
            }
        )
    if storm_codes:
        has_hail = any(int(_number(code)) in {96, 99} for code in storm_codes)
        signals.append(
            {
                "type": "thunderstorm_hail" if has_hail else "thunderstorm",
                "severity": 3 if has_hail else 2,
                "evidence": "Mô hình dự báo có dông kèm mưa đá"
                if has_hail
                else "Mô hình dự báo có dông",
            }
        )
    if max_gust >= 50:
        signals.append(
            {
                "type": "strong_wind",
                "severity": 2 if max_gust < 75 else 3,
                "evidence": f"Gió giật lớn nhất {max_gust:.1f} km/h",
            }
        )

    max_severity = max((item["severity"] for item in signals), default=0)
    ui = {
        0: {"level": 0, "label": "Bình thường", "color": "#2E7D32", "icon": "✅"},
        1: {"level": 1, "label": "Chú ý", "color": "#F9A825", "icon": "⚠️"},
        2: {"level": 2, "label": "Nguy hiểm", "color": "#EF6C00", "icon": "🟠"},
        3: {"level": 3, "label": "Rất nguy hiểm", "color": "#C62828", "icon": "🔴"},
    }[max_severity]

    current = payload.get("current", {})
    current_code = int(_number(current.get("weather_code")))
    return {
        "generated_at": utc_now_iso(),
        "model_timezone": payload.get("timezone"),
        "current": {
            "time": current.get("time"),
            "weather_code": current_code,
            "condition": WEATHER_CODES.get(current_code, f"Mã WMO {current_code}"),
            **weather_condition_ui(current_code),
            "temperature_c": current.get("temperature_2m"),
            "apparent_temperature_c": current.get("apparent_temperature"),
            "humidity_percent": current.get("relative_humidity_2m"),
            "precipitation_mm": current.get("precipitation"),
            "rain_mm": current.get("rain"),
            "cloud_cover_percent": current.get("cloud_cover"),
            "visibility_m": current.get("visibility"),
            "wind_speed_kmh": current.get("wind_speed_10m"),
            "wind_direction_deg": current.get("wind_direction_10m"),
            "wind_gust_kmh": current.get("wind_gusts_10m"),
        },
        "risk_scale": ui,
        "signals": signals,
        "daily": daily,
        "six_hour_periods": periods,
        "note": "Ngưỡng tín hiệu là quy tắc sàng lọc của nguyên mẫu, không thay thế bản tin chuyên môn.",
    }


class WeatherService:
    def __init__(self, landslide_service: LandslideService, timeout: float = 30):
        self.landslide_service = landslide_service
        self.timeout = timeout
        self._geocode_cache: dict[str, dict[str, Any]] = {}
        self._nominatim_lock = threading.Lock()
        self._last_nominatim_call = 0.0

    @staticmethod
    def _inside_dien_bien(latitude: float, longitude: float) -> bool:
        # Hop bao rong de chan ket qua geocode o tinh/quoc gia khac.
        return 20.5 <= latitude <= 23.0 and 101.5 <= longitude <= 104.5

    def _open_meteo_geocode(self, commune: str) -> dict[str, Any] | None:
        for query_name in (commune, f"{commune} Dien Bien"):
            payload = request_json(
                GEOCODING_URL,
                timeout=self.timeout,
                query={"name": query_name, "count": 20, "language": "vi", "countryCode": "VN"},
            )
            for item in payload.get("results", []) if isinstance(payload, dict) else []:
                admin_text = normalize_text(
                    " ".join(str(item.get(k, "")) for k in ("admin1", "admin2", "admin3", "admin4"))
                )
                latitude = _number(item.get("latitude"), 999)
                longitude = _number(item.get("longitude"), 999)
                if "dien bien" in admin_text and self._inside_dien_bien(latitude, longitude):
                    return {
                        "name": item.get("name"),
                        "display_name": ", ".join(
                            str(item.get(k))
                            for k in ("name", "admin2", "admin1", "country")
                            if item.get(k)
                        ),
                        "latitude": latitude,
                        "longitude": longitude,
                        "resolver": "Open-Meteo Geocoding",
                    }
        return None

    def _nominatim_geocode(self, commune: str) -> dict[str, Any] | None:
        # Public Nominatim yeu cau gioi han tan suat; khoa nay giu toi da 1 req/s
        # trong mot process, con cache ben duoi tranh goi lai cung dia danh.
        with self._nominatim_lock:
            wait_seconds = 1.0 - (time.monotonic() - self._last_nominatim_call)
            if wait_seconds > 0:
                time.sleep(wait_seconds)
            payload = request_json(
                NOMINATIM_URL,
                timeout=self.timeout,
                query={
                    "q": f"{commune}, Điện Biên, Việt Nam",
                    "format": "jsonv2",
                    "addressdetails": 1,
                    "countrycodes": "vn",
                    "limit": 10,
                },
            )
            self._last_nominatim_call = time.monotonic()
        for item in payload if isinstance(payload, list) else []:
            latitude = _number(item.get("lat"), 999)
            longitude = _number(item.get("lon"), 999)
            display_name = str(item.get("display_name", ""))
            if (
                "dien bien" in normalize_text(display_name)
                and self._inside_dien_bien(latitude, longitude)
            ):
                return {
                    "name": commune,
                    "display_name": display_name,
                    "latitude": latitude,
                    "longitude": longitude,
                    "resolver": "OpenStreetMap Nominatim",
                }
        return None

    def resolve_location(
        self,
        commune: str,
        latitude: float | None = None,
        longitude: float | None = None,
    ) -> dict[str, Any]:
        if (latitude is None) != (longitude is None):
            raise ValueError("Phải truyền đồng thời latitude và longitude.")
        if latitude is not None and longitude is not None:
            if not self._inside_dien_bien(latitude, longitude):
                raise ValueError("Tọa độ nằm ngoài vùng kiểm tra rộng của Điện Biên.")
            return {
                "name": commune,
                "display_name": f"{commune}, Điện Biên",
                "latitude": latitude,
                "longitude": longitude,
                "resolver": "user_coordinates",
            }

        cache_key = normalize_text(commune)
        if cache_key in self._geocode_cache:
            return dict(self._geocode_cache[cache_key])

        cached_coordinates = self.landslide_service.find_coordinates(commune)
        if cached_coordinates:
            result = {
                "name": commune,
                "display_name": f"{commune}, Điện Biên",
                "latitude": cached_coordinates[0],
                "longitude": cached_coordinates[1],
                "resolver": "NCHMF landslide dataset",
            }
            self._geocode_cache[cache_key] = result
            return dict(result)

        errors: list[str] = []
        try:
            result = self._open_meteo_geocode(commune)
            if result:
                self._geocode_cache[cache_key] = result
                return dict(result)
        except DataSourceError as exc:
            errors.append(str(exc))
        try:
            result = self._nominatim_geocode(commune)
            if result:
                self._geocode_cache[cache_key] = result
                return dict(result)
        except DataSourceError as exc:
            errors.append(str(exc))

        detail = f" Chi tiết: {'; '.join(errors)}" if errors else ""
        raise DataSourceError(
            f"Không xác định được tọa độ của '{commune}' tại Điện Biên. "
            f"Hãy truyền latitude/longitude để tránh nhầm địa danh.{detail}"
        )

    def get_forecast(
        self,
        commune: str,
        days: int = 3,
        latitude: float | None = None,
        longitude: float | None = None,
    ) -> dict[str, Any]:
        days = min(max(int(days), 1), 7)
        location = self.resolve_location(commune, latitude, longitude)
        payload = request_json(
            FORECAST_URL,
            timeout=self.timeout,
            query={
                "latitude": location["latitude"],
                "longitude": location["longitude"],
                "timezone": "Asia/Ho_Chi_Minh",
                "forecast_days": days,
                "current": (
                    "temperature_2m,apparent_temperature,relative_humidity_2m,"
                    "precipitation,rain,weather_code,cloud_cover,visibility,"
                    "wind_speed_10m,wind_direction_10m,wind_gusts_10m"
                ),
                "hourly": (
                    "temperature_2m,apparent_temperature,relative_humidity_2m,"
                    "precipitation_probability,precipitation,weather_code,visibility,"
                    "wind_speed_10m,wind_direction_10m,wind_gusts_10m"
                ),
                "daily": (
                    "weather_code,temperature_2m_max,temperature_2m_min,"
                    "apparent_temperature_max,apparent_temperature_min,"
                    "precipitation_sum,precipitation_hours,"
                    "precipitation_probability_max,wind_gusts_10m_max,sunrise,sunset"
                ),
            },
        )
        if not isinstance(payload, dict) or "hourly" not in payload:
            raise DataSourceError("Open-Meteo không trả về dữ liệu dự báo hợp lệ.")
        ensemble_confidence = self._fetch_ensemble_confidence(location, days)
        return {
            "requested_commune": commune,
            "location": location,
            "source": "https://open-meteo.com/en/docs",
            "forecast": summarize_forecast(payload, days, ensemble_confidence),
        }

    def _fetch_ensemble_confidence(
        self, location: dict[str, Any], days: int
    ) -> list[dict[str, Any] | None] | None:
        """Fetch model spread without coupling availability to the forecast."""
        try:
            ensemble_payload = request_json(
                FORECAST_URL,
                timeout=self.timeout,
                query={
                    "latitude": location["latitude"],
                    "longitude": location["longitude"],
                    "timezone": "Asia/Ho_Chi_Minh",
                    "forecast_days": days,
                    "daily": "precipitation_sum,temperature_2m_max",
                    "models": ",".join(ENSEMBLE_MODELS),
                },
            )
        except DataSourceError as exc:
            _log.warning("ensemble confidence unavailable for %s: %s", location.get("name"), exc)
            return None
        if not isinstance(ensemble_payload, dict):
            return None
        return _ensemble_daily_confidence(ensemble_payload, days)
