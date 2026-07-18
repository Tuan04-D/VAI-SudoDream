"""
One-off training script for the terrain (elevation) correction — temperature
AND precipitation — NOT part of the runtime server. Run manually, inspect
the printed metrics, then hand-copy the fitted coefficients into
weather_ai/terrain_correction.py.

Data: Open-Meteo Historical Weather API, all 45 Điện Biên communes
(communes.py), 1 year of daily temperature_2m_mean + precipitation_sum.
  - "raw" = archive API with no `models` param (Open-Meteo's own best-match,
    already lapse-rate adjusted to the query point's elevation).
  - Ground truth = era5_land (~9km) for temperature, plain era5 (~25-31km)
    for precipitation — Open-Meteo's era5_land archive returns null for
    precipitation_sum entirely (confirmed empirically), so precipitation
    ground truth is coarser than temperature's. Both are real independent
    reanalysis, used as ground truth since there is no historical-disaster
    label requirement — see VAIC2026_Overview_SanPham_ChiTiet.md 4.5.A.

Split: spatial holdout, systematic across the elevation range — communes are
sorted by elevation and every 5th one is held out (~9 of 45), so the test set
spans low/mid/high elevation instead of only the extremes. A first pass with
only 10 hand-picked points (8 train / 2 test-at-the-extreme) generalized
poorly for temperature (test MAE got WORSE after correction) — this version
trades a few extra minutes of data collection for a statistically sturdier
coefficient, and reuses the same fetch for a second precipitation model.
"""
from __future__ import annotations

import csv
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))
import communes  # noqa: E402

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
ELEVATION_URL = "https://api.open-meteo.com/v1/elevation"

START_DATE = "2025-07-10"
END_DATE = "2026-07-10"
TEST_EVERY_NTH = 5  # holds out ~20% of communes, spread across the elevation range
DAILY_VARS = "temperature_2m_mean,precipitation_sum"

OUT_CSV = Path(__file__).parent / "terrain_correction_dataset.csv"


def fetch_json(url: str, query: dict) -> dict:
    full_url = f"{url}?{urllib.parse.urlencode(query)}"
    for attempt in range(5):
        try:
            with urllib.request.urlopen(full_url, timeout=60) as response:
                return json.loads(response.read())
        except (urllib.error.URLError, ConnectionResetError) as exc:
            if attempt == 4:
                raise
            wait_seconds = 3 * (attempt + 1)
            print(f"  request failed ({exc}), retrying in {wait_seconds}s...")
            time.sleep(wait_seconds)


def fetch_point_series(lat: float, lon: float) -> dict:
    raw = fetch_json(
        ARCHIVE_URL,
        {
            "latitude": lat, "longitude": lon,
            "start_date": START_DATE, "end_date": END_DATE,
            "daily": DAILY_VARS, "timezone": "Asia/Ho_Chi_Minh",
        },
    )
    # era5_land has no precipitation_sum in Open-Meteo's archive (confirmed
    # empirically — always null, both daily and hourly). era5 (~25-31km,
    # coarser than era5_land's ~9km) does have it, so temperature ground
    # truth uses era5_land and precipitation ground truth uses plain era5 —
    # requesting both models together still suffixes both variables the same
    # way, we just read the precip column from the era5 suffix.
    ground_truth = fetch_json(
        ARCHIVE_URL,
        {
            "latitude": lat, "longitude": lon,
            "start_date": START_DATE, "end_date": END_DATE,
            "daily": DAILY_VARS, "models": "era5_land,era5",
            "timezone": "Asia/Ho_Chi_Minh",
        },
    )
    return {
        "time": raw["daily"]["time"],
        "raw_temp": raw["daily"]["temperature_2m_mean"],
        "raw_precip": raw["daily"]["precipitation_sum"],
        "era5_temp": ground_truth["daily"]["temperature_2m_mean_era5_land"],
        "era5_precip": ground_truth["daily"]["precipitation_sum_era5"],
    }


def fit(train_rows: list[dict], value_key: str) -> tuple[float, float, float, float]:
    def features(row: dict) -> list[float]:
        angle = 2 * np.pi * row["month"] / 12
        return [1.0, row["elevation"], np.sin(angle), np.cos(angle)]

    X = np.array([features(r) for r in train_rows])
    y = np.array([r[f"target_residual_{value_key}"] for r in train_rows])
    coefficients, *_ = np.linalg.lstsq(X, y, rcond=None)
    return tuple(coefficients)


def predict(row: dict, coefficients: tuple[float, float, float, float]) -> float:
    intercept, elevation_coef, sin_coef, cos_coef = coefficients
    angle = 2 * np.pi * row["month"] / 12
    return intercept + elevation_coef * row["elevation"] + sin_coef * np.sin(angle) + cos_coef * np.cos(angle)


def mae(rows: list[dict], value_key: str, coefficients: tuple[float, float, float, float] | None) -> float:
    errors = []
    for r in rows:
        predicted = r[f"raw_{value_key}"] + (predict(r, coefficients) if coefficients else 0.0)
        errors.append(abs(predicted - r[f"era5_{value_key}"]))
    return sum(errors) / len(errors)


def report(rows: list[dict], value_key: str, label: str, unit: str) -> None:
    train_rows = [r for r in rows if r["split"] == "train"]
    test_rows = [r for r in rows if r["split"] == "test"]
    coefficients = fit(train_rows, value_key)
    intercept, elevation_coef, sin_coef, cos_coef = coefficients

    print(f"\n=== {label}: fitted coefficients (residual = era5land - raw) ===")
    print(f"intercept        = {intercept:.5f}")
    print(f"elevation_coef   = {elevation_coef:.6f}   (per metre)")
    print(f"month_sin_coef   = {sin_coef:.5f}")
    print(f"month_cos_coef   = {cos_coef:.5f}")

    print(f"\n=== {label}: MAE vs ERA5-Land ({unit}) ===")
    print(
        f"TRAIN ({len(train_rows) // 365 if len(train_rows) >= 365 else '?'} điểm, {len(train_rows)} ngày)  "
        f"raw={mae(train_rows, value_key, None):.3f}{unit}  corrected={mae(train_rows, value_key, coefficients):.3f}{unit}"
    )
    print(
        f"TEST  (điểm giữ lại, {len(test_rows)} ngày, chưa từng train)  "
        f"raw={mae(test_rows, value_key, None):.3f}{unit}  corrected={mae(test_rows, value_key, coefficients):.3f}{unit}"
    )
    print(f"\nPer test point ({label}):")
    for name in sorted({r["point"] for r in test_rows}):
        subset = [r for r in test_rows if r["point"] == name]
        print(
            f"  {name}: raw={mae(subset, value_key, None):.3f}{unit}  corrected={mae(subset, value_key, coefficients):.3f}{unit}"
            f"  (elevation={subset[0]['elevation']}m, n={len(subset)})"
        )


def main() -> None:
    all_communes = communes.COMMUNES
    lats = ",".join(str(c["lat"]) for c in all_communes)
    lons = ",".join(str(c["lon"]) for c in all_communes)
    elevations = fetch_json(ELEVATION_URL, {"latitude": lats, "longitude": lons})["elevation"]

    ranked = sorted(zip(all_communes, elevations), key=lambda pair: pair[1])
    points = [
        (c["name"], c["lat"], c["lon"], elevation, "test" if index % TEST_EVERY_NTH == 0 else "train")
        for index, (c, elevation) in enumerate(ranked)
    ]
    n_test = sum(1 for p in points if p[4] == "test")
    print(f"{len(points)} communes total: {len(points) - n_test} train, {n_test} test (every {TEST_EVERY_NTH}th by elevation)\n")

    rows: list[dict] = []
    for name, lat, lon, elevation, split in points:
        print(f"fetching {name} (elevation {elevation}m, {split})...")
        series = fetch_point_series(lat, lon)
        for date, raw_t, era5_t, raw_p, era5_p in zip(
            series["time"], series["raw_temp"], series["era5_temp"], series["raw_precip"], series["era5_precip"]
        ):
            if raw_t is None or era5_t is None or raw_p is None or era5_p is None:
                continue
            month = int(date.split("-")[1])
            rows.append(
                {
                    "point": name, "split": split, "date": date,
                    "elevation": elevation, "month": month,
                    "raw_temp": raw_t, "era5_temp": era5_t,
                    "raw_precip": raw_p, "era5_precip": era5_p,
                    "target_residual_temp": round(era5_t - raw_t, 3),
                    "target_residual_precip": round(era5_p - raw_p, 3),
                }
            )

    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"\nwrote {len(rows)} rows to {OUT_CSV}")

    report(rows, "temp", "TEMPERATURE", "°C")
    report(rows, "precip", "PRECIPITATION", "mm")


if __name__ == "__main__":
    main()
