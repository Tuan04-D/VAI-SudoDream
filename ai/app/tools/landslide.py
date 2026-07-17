from __future__ import annotations

import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from .common import (
    DataSourceError,
    normalize_text,
    read_json,
    request_json,
    utc_now_iso,
    write_json_atomic,
)


SOURCE_PAGE = "https://luquetsatlo.nchmf.gov.vn/"
SOURCE_ENDPOINT = (
    "https://luquetsatlo.nchmf.gov.vn/LayerMapBox/getDSCanhbaoSLLQ"
)
DIEN_BIEN_NAMES = {"dien bien", "tinh dien bien"}
RISK_RANK = {"": 0, "trung binh": 1, "cao": 2, "rat cao": 3}
RISK_UI = {
    0: {"level": 0, "label": "Chưa ghi nhận", "color": "#2E7D32", "icon": "✅"},
    1: {"level": 1, "label": "Trung bình", "color": "#F9A825", "icon": "⚠️"},
    2: {"level": 2, "label": "Cao", "color": "#EF6C00", "icon": "🟠"},
    3: {"level": 3, "label": "Rất cao", "color": "#C62828", "icon": "🔴"},
}


def _rank(value: Any) -> int:
    return RISK_RANK.get(normalize_text(value), 0)


class LandslideService:
    """Lay canh bao NCHMF, loc Dien Bien va luu cache tren dia."""

    def __init__(self, cache_path: Path, refresh_hours: int = 6, timeout: float = 30):
        self.cache_path = cache_path
        self.refresh_hours = refresh_hours
        self.timeout = timeout
        self._lock = threading.RLock()

    def _cache_is_fresh(self, cache: dict[str, Any] | None) -> bool:
        if not cache or not cache.get("fetched_at"):
            return False
        try:
            fetched = datetime.fromisoformat(cache["fetched_at"])
            if fetched.tzinfo is None:
                fetched = fetched.replace(tzinfo=timezone.utc)
            return datetime.now(timezone.utc) - fetched < timedelta(
                hours=self.refresh_hours
            )
        except (TypeError, ValueError):
            return False

    def _fetch_remote(self) -> dict[str, Any]:
        local_now = datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).replace(
            minute=0, second=0, microsecond=0
        )
        # Endpoint cong khai cua ban do nhan moc gio dia phuong va cua so du bao 6h.
        raw = request_json(
            SOURCE_ENDPOINT,
            timeout=self.timeout,
            form={"sogiodubao": 6, "date": local_now.strftime("%Y-%m-%d %H:00:00")},
        )
        if not isinstance(raw, list):
            raise DataSourceError("Nguon NCHMF khong tra ve mot danh sach JSON.")

        records = [
            item
            for item in raw
            if isinstance(item, dict)
            and (
                normalize_text(item.get("provinceName")) in DIEN_BIEN_NAMES
                or normalize_text(item.get("provinceName_2cap")) in DIEN_BIEN_NAMES
            )
        ]
        return {
            "source": SOURCE_PAGE,
            "endpoint": SOURCE_ENDPOINT,
            "requested_time": local_now.isoformat(),
            "forecast_window_hours": 6,
            "fetched_at": utc_now_iso(),
            "records": records,
        }

    def refresh(self, force: bool = False) -> dict[str, Any]:
        with self._lock:
            cached = read_json(self.cache_path)
            if not force and self._cache_is_fresh(cached):
                cached["cache_status"] = "fresh"
                return cached
            try:
                fresh = self._fetch_remote()
                write_json_atomic(self.cache_path, fresh)
                fresh["cache_status"] = "refreshed"
                return fresh
            except DataSourceError:
                if cached:
                    cached["cache_status"] = "stale_fallback"
                    cached["stale"] = True
                    return cached
                raise

    @staticmethod
    def _matches(
        record: dict[str, Any], location: str, *, include_district: bool = True
    ) -> bool:
        wanted = normalize_text(location)
        if not wanted:
            return True
        candidates = [
            record.get("commune_name_2cap"),
            record.get("commune_name"),
        ]
        if include_district:
            candidates.append(record.get("district_name"))
        return any(
            wanted in normalize_text(candidate)
            or normalize_text(candidate) in wanted
            for candidate in candidates
            if candidate
        )

    @classmethod
    def _filter_location(
        cls, records: list[dict[str, Any]], location: str
    ) -> list[dict[str, Any]]:
        if not normalize_text(location):
            return records
        # Sau sap nhap, ten mot xa moi co the trung ten huyen cu (vd. Tua Chua).
        # Uu tien khop o cap xa; chi roi xuong huyen neu khong co xa nao khop.
        commune_matches = [
            record
            for record in records
            if cls._matches(record, location, include_district=False)
        ]
        if commune_matches:
            return commune_matches
        return [
            record
            for record in records
            if cls._matches(record, location, include_district=True)
        ]

    @staticmethod
    def _deduplicate(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        selected: dict[str, dict[str, Any]] = {}
        for record in records:
            key = str(
                record.get("commune_id_2cap")
                or normalize_text(record.get("commune_name_2cap"))
                or record.get("commune_id")
            )
            score = max(
                _rank(record.get("nguycosatlo")), _rank(record.get("nguycoluquet"))
            )
            previous = selected.get(key)
            previous_score = (
                max(
                    _rank(previous.get("nguycosatlo")),
                    _rank(previous.get("nguycoluquet")),
                )
                if previous
                else -1
            )
            if previous is None or score > previous_score:
                selected[key] = record
        return sorted(
            selected.values(),
            key=lambda item: max(
                _rank(item.get("nguycosatlo")), _rank(item.get("nguycoluquet"))
            ),
            reverse=True,
        )

    def get_warnings(self, commune: str = "") -> dict[str, Any]:
        payload = self.refresh(force=False)
        matched = self._filter_location(payload.get("records", []), commune)
        matched = self._deduplicate(matched)
        max_rank = max(
            (
                max(_rank(item.get("nguycosatlo")), _rank(item.get("nguycoluquet")))
                for item in matched
            ),
            default=0,
        )
        compact = [
            {
                "commune": item.get("commune_name_2cap") or item.get("commune_name"),
                "former_commune": item.get("commune_name"),
                "district": item.get("district_name"),
                "landslide_risk": item.get("nguycosatlo"),
                "flash_flood_risk": item.get("nguycoluquet"),
                "observed_rain_mm": item.get("luongmuatd"),
                "forecast_rain_mm": item.get("luongmuadb"),
                "combined_rain_mm": item.get("luongmuatd_db"),
                "latitude": item.get("lat"),
                "longitude": item.get("lon"),
                "source_time": item.get("thoigian"),
            }
            for item in matched
        ]
        return {
            "requested_commune": commune or None,
            "province": "Điện Biên",
            "source": payload.get("source", SOURCE_PAGE),
            "fetched_at": payload.get("fetched_at"),
            "requested_time": payload.get("requested_time"),
            "forecast_window_hours": payload.get("forecast_window_hours", 6),
            "cache_status": payload.get("cache_status"),
            "stale": bool(payload.get("stale", False)),
            "warning_count": len(compact),
            "risk_scale": RISK_UI[max_rank],
            "warnings": compact,
            "interpretation": (
                "Không tìm thấy xã này trong danh sách cảnh báo hiện tại của nguồn. "
                "Điều này không phải là cam kết an toàn tuyệt đối."
                if commune and not compact
                else "Dữ liệu cảnh báo được tổng hợp theo mức cao nhất tại xã."
            ),
        }

    def find_coordinates(self, commune: str) -> tuple[float, float] | None:
        payload = self.refresh(force=False)
        matches = [
            record
            for record in self._filter_location(payload.get("records", []), commune)
            if record.get("lat") is not None and record.get("lon") is not None
        ]
        if not matches:
            return None
        best = max(
            matches,
            key=lambda item: max(
                _rank(item.get("nguycosatlo")), _rank(item.get("nguycoluquet"))
            ),
        )
        return float(best["lat"]), float(best["lon"])
