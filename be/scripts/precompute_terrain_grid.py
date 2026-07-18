"""
One-off script: precomputes elevation for every commune centroid AND a grid
of points inside each commune's polygon, and writes it to
data/dienbien_terrain.json. This file is loaded statically at server startup
(see weather_ai/tools/terrain.py) so the hot request path never depends on a
live Elevation API call — communes don't move, elevation doesn't change.
"""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
import communes  # noqa: E402
import geo_utils  # noqa: E402

ELEVATION_URL = "https://api.open-meteo.com/v1/elevation"
OUT_PATH = communes.DATA_DIR / "dienbien_terrain.json"
BATCH_SIZE = 90


def fetch_elevations(points: list[tuple[float, float]]) -> list[float]:
    elevations: list[float] = []
    for start in range(0, len(points), BATCH_SIZE):
        batch = points[start : start + BATCH_SIZE]
        lats = ",".join(str(lat) for lat, _ in batch)
        lons = ",".join(str(lon) for _, lon in batch)
        url = f"{ELEVATION_URL}?{urllib.parse.urlencode({'latitude': lats, 'longitude': lons})}"
        for attempt in range(6):
            try:
                with urllib.request.urlopen(url, timeout=60) as response:
                    elevations.extend(json.loads(response.read())["elevation"])
                break
            except urllib.error.HTTPError as exc:
                if exc.code != 429 or attempt == 5:
                    raise
                wait_seconds = 5 * (attempt + 1)
                print(f"  429 rate limited, waiting {wait_seconds}s...")
                time.sleep(wait_seconds)
        time.sleep(1.5)
    return elevations


def main() -> None:
    centroid_points = [(c["lat"], c["lon"]) for c in communes.COMMUNES]
    print(f"fetching {len(centroid_points)} commune centroid elevations...")
    centroid_elevations = fetch_elevations(centroid_points)

    grid_by_commune: dict[str, list[tuple[float, float]]] = {}
    all_grid_points: list[tuple[float, float]] = []
    for commune in communes.COMMUNES:
        grid = geo_utils.grid_points_in_commune(commune["id"], resolution=7)
        grid_by_commune[commune["id"]] = grid
        all_grid_points.extend(grid)
    print(f"fetching {len(all_grid_points)} grid-point elevations across {len(communes.COMMUNES)} communes...")
    all_grid_elevations = fetch_elevations(all_grid_points)

    grid_elevation_iter = iter(all_grid_elevations)
    result: dict[str, dict] = {}
    for commune, centroid_elevation in zip(communes.COMMUNES, centroid_elevations):
        grid = grid_by_commune[commune["id"]]
        grid_out = []
        for lat, lon in grid:
            grid_out.append({"lat": lat, "lon": lon, "elevation_m": next(grid_elevation_iter)})
        result[commune["id"]] = {
            "centroid_elevation_m": centroid_elevation,
            "grid": grid_out,
        }

    OUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    total_grid_points = sum(len(v["grid"]) for v in result.values())
    print(f"wrote {OUT_PATH} — {len(result)} communes, {total_grid_points} grid points total")


if __name__ == "__main__":
    main()
