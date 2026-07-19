from __future__ import annotations

import hashlib
import json
import math
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_POINTS_PATH = ROOT / "be" / "data" / "dienbien_communes_meta.json"
DATA_DIR = Path(__file__).resolve().parent / "data"
ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"

HOURLY_VARIABLES = (
    "temperature_2m",
    "precipitation",
    "relative_humidity_2m",
    "wind_speed_10m",
    "wind_gusts_10m",
    "cloud_cover",
)


def load_points(path: Path = DEFAULT_POINTS_PATH, max_points: int | None = 20) -> list[dict[str, Any]]:
    points = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(points, list) or not points:
        raise ValueError(f"No points found in {path}")
    normalized = [
        {
            "id": str(point["id"]),
            "name": str(point["name"]),
            "lat": float(point["lat"]),
            "lon": float(point["lon"]),
        }
        for point in points
    ]
    if max_points is None or max_points >= len(normalized):
        return sorted(normalized, key=lambda item: item["id"])
    if max_points < 2:
        raise ValueError("max_points must be at least 2")

    # Deterministic farthest-point sampling gives broad coverage without
    # pretending that commune centroids form a regular meteorological grid.
    center_lat = sum(p["lat"] for p in normalized) / len(normalized)
    center_lon = sum(p["lon"] for p in normalized) / len(normalized)
    first = min(normalized, key=lambda p: _distance_km(p["lat"], p["lon"], center_lat, center_lon))
    selected = [first]
    remaining = [point for point in normalized if point["id"] != first["id"]]
    while remaining and len(selected) < max_points:
        next_point = max(
            remaining,
            key=lambda candidate: min(
                _distance_km(candidate["lat"], candidate["lon"], chosen["lat"], chosen["lon"])
                for chosen in selected
            ),
        )
        selected.append(next_point)
        remaining.remove(next_point)
    return selected


def _distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0088
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * radius_km * math.asin(math.sqrt(a))


def request_json(
    base_url: str,
    params: dict[str, Any],
    *,
    cache_dir: Path | None = None,
    timeout: int = 120,
    retries: int = 5,
) -> dict[str, Any]:
    query = urllib.parse.urlencode(params)
    url = f"{base_url}?{query}"
    cache_path: Path | None = None
    if cache_dir is not None:
        cache_dir.mkdir(parents=True, exist_ok=True)
        digest = hashlib.sha256(url.encode("utf-8")).hexdigest()
        cache_path = cache_dir / f"{digest}.json"
        if cache_path.exists():
            return json.loads(cache_path.read_text(encoding="utf-8"))

    headers = {"User-Agent": "TramBan-research/1.0 (offline reproducibility pipeline)"}
    request = urllib.request.Request(url, headers=headers)
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                payload = json.loads(response.read())
            if not isinstance(payload, dict) or payload.get("error"):
                raise RuntimeError(f"Provider error: {payload}")
            if cache_path is not None:
                cache_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
            return payload
        except (urllib.error.URLError, TimeoutError, ConnectionResetError, RuntimeError) as exc:
            if attempt == retries - 1:
                raise RuntimeError(f"Request failed after {retries} attempts: {url}") from exc
            time.sleep(min(30, 2 ** attempt))
    raise AssertionError("unreachable")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

