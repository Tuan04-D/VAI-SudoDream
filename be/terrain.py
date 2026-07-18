"""Static per-commune terrain data (centroid + in-polygon grid elevations),
precomputed once by scripts/precompute_terrain_grid.py — see
data/dienbien_terrain.json. Loaded at import time: communes and elevation
don't change at runtime, so the hot request path never calls the Elevation
API live.
"""
import json

import communes

with open(communes.DATA_DIR / "dienbien_terrain.json", encoding="utf-8") as f:
    _TERRAIN_BY_COMMUNE_ID = json.load(f)


def centroid_elevation(commune_id: str) -> float | None:
    entry = _TERRAIN_BY_COMMUNE_ID.get(commune_id)
    return entry["centroid_elevation_m"] if entry else None


def grid_points(commune_id: str) -> list[dict]:
    """Each item: {lat, lon, elevation_m}."""
    entry = _TERRAIN_BY_COMMUNE_ID.get(commune_id)
    return entry["grid"] if entry else []
