from __future__ import annotations

import argparse
import csv
import gzip
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from pathlib import Path
from typing import Any

from common import (
    ARTIFACTS_DIR,
    DATA_DIR,
    DEFAULT_POINTS_PATH,
    HOURLY_VARIABLES,
    load_points,
    request_json,
    sha256_file,
)


HISTORICAL_FORECAST_URL = "https://historical-forecast-api.open-meteo.com/v1/forecast"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
ELEVATION_URL = "https://api.open-meteo.com/v1/elevation"

# ERA5-Land does not expose precipitation, wind speed or cloud cover through
# Open-Meteo. These targets deliberately fall back to ERA5 and are identified
# as reference-comparison variables, not 9/11-km downscaling targets.
TARGET_SOURCE = {
    "temperature_2m": "era5_land",
    "relative_humidity_2m": "era5_land",
    "wind_gusts_10m": "era5",
    "precipitation": "era5",
    "wind_speed_10m": "era5",
    "cloud_cover": "era5",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build aligned GFS Global / ERA reference hourly pairs.")
    parser.add_argument("--start-date", default="2023-01-01")
    parser.add_argument("--end-date", default="2025-12-31")
    parser.add_argument("--max-points", type=int, default=20)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--points", type=Path, default=DEFAULT_POINTS_PATH)
    parser.add_argument("--terrain-features", type=Path, default=DATA_DIR / "terrain_features.csv")
    parser.add_argument("--output", type=Path, default=DATA_DIR / "processed" / "hourly_pairs.csv.gz")
    parser.add_argument("--manifest", type=Path, default=ARTIFACTS_DIR / "dataset_manifest.json")
    return parser.parse_args()


def validate_dates(start_date: str, end_date: str) -> None:
    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    if start > end:
        raise ValueError("start-date must be before end-date")


def load_terrain(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return {str(row["point_id"]): row for row in csv.DictReader(handle)}


def elevation_fallback(points: list[dict[str, Any]], cache_dir: Path) -> dict[str, float]:
    payload = request_json(
        ELEVATION_URL,
        {
            "latitude": ",".join(str(point["lat"]) for point in points),
            "longitude": ",".join(str(point["lon"]) for point in points),
        },
        cache_dir=cache_dir,
    )
    elevations = payload.get("elevation", [])
    if len(elevations) != len(points):
        raise RuntimeError("Elevation API returned an unexpected number of values")
    return {point["id"]: float(value) for point, value in zip(points, elevations)}


def fetch_point(
    point: dict[str, Any],
    start_date: str,
    end_date: str,
    cache_dir: Path,
) -> tuple[dict[str, Any], dict[str, Any]]:
    common_params = {
        "latitude": point["lat"],
        "longitude": point["lon"],
        "start_date": start_date,
        "end_date": end_date,
        "hourly": ",".join(HOURLY_VARIABLES),
        "timezone": "UTC",
        "elevation": "nan",
        "cell_selection": "nearest",
    }
    raw = request_json(
        HISTORICAL_FORECAST_URL,
        {**common_params, "models": "gfs_global"},
        cache_dir=cache_dir / "gfs_global",
    )
    reference = request_json(
        ARCHIVE_URL,
        {**common_params, "models": "era5_land,era5"},
        cache_dir=cache_dir / "reference",
    )
    return raw, reference


def series_by_time(payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    hourly = payload.get("hourly", {})
    times = hourly.get("time", [])
    return {
        timestamp: {
            key: values[index] if index < len(values) else None
            for key, values in hourly.items()
            if key != "time" and isinstance(values, list)
        }
        for index, timestamp in enumerate(times)
    }


def reference_value(values: dict[str, Any], variable: str) -> Any:
    source = TARGET_SOURCE[variable]
    return values.get(f"{variable}_{source}")


def terrain_values(
    point: dict[str, Any],
    terrain: dict[str, dict[str, Any]],
    fallback_elevations: dict[str, float],
) -> dict[str, Any]:
    row = terrain.get(point["id"])
    if row:
        return {
            "terrain_source": row.get("terrain_source", "srtm_gl1_30m"),
            "elevation_m": float(row["elevation_m"]),
            "slope_deg": float(row["slope_deg"]),
            "aspect_deg": float(row["aspect_deg"]),
            "tpi_m": float(row["tpi_m"]),
            "delta_h_m": float(row["delta_h_m"]),
        }
    return {
        "terrain_source": "open_meteo_elevation_90m_fallback",
        "elevation_m": fallback_elevations[point["id"]],
        "slope_deg": 0.0,
        "aspect_deg": 0.0,
        "tpi_m": 0.0,
        "delta_h_m": 0.0,
    }


def rows_for_point(
    point: dict[str, Any],
    raw: dict[str, Any],
    reference: dict[str, Any],
    terrain: dict[str, Any],
) -> list[dict[str, Any]]:
    raw_series = series_by_time(raw)
    reference_series = series_by_time(reference)
    timestamps = sorted(set(raw_series) & set(reference_series))
    rows: list[dict[str, Any]] = []
    for timestamp in timestamps:
        raw_values = raw_series[timestamp]
        reference_values = reference_series[timestamp]
        values = {
            **{f"raw_{variable}": raw_values.get(variable) for variable in HOURLY_VARIABLES},
            **{f"target_{variable}": reference_value(reference_values, variable) for variable in HOURLY_VARIABLES},
        }
        if any(values[f"raw_{variable}"] is None for variable in HOURLY_VARIABLES):
            continue
        if values["target_temperature_2m"] is None or values["target_relative_humidity_2m"] is None:
            continue
        rows.append(
            {
                "point_id": point["id"],
                "point_name": point["name"],
                "latitude": point["lat"],
                "longitude": point["lon"],
                "timestamp_utc": timestamp,
                "gfs_grid_elevation_m": raw.get("elevation"),
                "reference_grid_elevation_m": reference.get("elevation"),
                **terrain,
                **values,
            }
        )
    return rows


def main() -> None:
    args = parse_args()
    validate_dates(args.start_date, args.end_date)
    points = load_points(args.points, args.max_points)
    cache_dir = DATA_DIR / "raw"
    terrain = load_terrain(args.terrain_features)
    fallback_elevations = elevation_fallback(points, cache_dir / "elevation")

    fetched: dict[str, tuple[dict[str, Any], dict[str, Any]]] = {}
    with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 4))) as pool:
        futures = {
            pool.submit(fetch_point, point, args.start_date, args.end_date, cache_dir): point
            for point in points
        }
        for index, future in enumerate(as_completed(futures), start=1):
            point = futures[future]
            fetched[point["id"]] = future.result()
            print(f"[{index}/{len(points)}] downloaded {point['name']}")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    fieldnames: list[str] | None = None
    row_count = 0
    with gzip.open(args.output, "wt", encoding="utf-8", newline="") as handle:
        writer: csv.DictWriter | None = None
        for point in points:
            raw, reference = fetched[point["id"]]
            static_terrain = terrain_values(point, terrain, fallback_elevations)
            point_rows = rows_for_point(point, raw, reference, static_terrain)
            if not point_rows:
                raise RuntimeError(f"No aligned rows for {point['name']}")
            if writer is None:
                fieldnames = list(point_rows[0])
                writer = csv.DictWriter(handle, fieldnames=fieldnames)
                writer.writeheader()
            writer.writerows(point_rows)
            row_count += len(point_rows)

    manifest = {
        "schema_version": 1,
        "purpose": "offline_research_only",
        "start_date": args.start_date,
        "end_date": args.end_date,
        "hourly_rows": row_count,
        "points": points,
        "point_count": len(points),
        "input": {
            "provider": "Open-Meteo Historical Forecast API",
            "model": "gfs_global",
            "nominal_resolution": "0.11 degree (~13 km)",
            "statistical_downscaling_disabled": True,
        },
        "reference": {
            "temperature_2m": "ERA5-Land 0.1 degree (~11 km)",
            "relative_humidity_2m": "ERA5-Land 0.1 degree (~11 km)",
            "wind_gusts_10m": "ERA5 0.25 degree (~25 km; comparison only)",
            "precipitation": "ERA5 0.25 degree (~25 km; comparison only)",
            "wind_speed_10m": "ERA5 0.25 degree (~25 km; comparison only)",
            "cloud_cover": "ERA5 0.25 degree (~25 km; comparison only)",
        },
        "terrain_source": "srtm_gl1_30m" if terrain else "open_meteo_elevation_90m_fallback",
        "boundary_source": "project OSM-derived post-2025 commune registry",
        "output": str(args.output.relative_to(Path(__file__).resolve().parent)),
        "sha256": sha256_file(args.output),
    }
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {row_count:,} rows to {args.output}")
    print(f"Wrote manifest to {args.manifest}")


if __name__ == "__main__":
    main()
