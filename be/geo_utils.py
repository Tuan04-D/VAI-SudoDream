"""Simulated resident GPS — a random point inside a commune's real polygon
boundary (from data/dienbien_communes.geojson), standing in for a real GPS
fix. Bounding-box rejection sampling + ray-casting point-in-polygon test,
pure stdlib (no shapely dependency for one geometry operation).
"""
import json
import random

import communes

with open(communes.DATA_DIR / "dienbien_communes.geojson", encoding="utf-8") as f:
    _COMMUNES_GEOJSON = json.load(f)

_POLYGON_BY_COMMUNE_ID = {
    str(feature["properties"]["id"]): feature["geometry"] for feature in _COMMUNES_GEOJSON["features"]
}


def _point_in_ring(lon: float, lat: float, ring: list[list[float]]) -> bool:
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > lat) != (yj > lat)) and (
            lon < (xj - xi) * (lat - yi) / (yj - yi) + xi
        ):
            inside = not inside
        j = i
    return inside


def _point_in_polygon(lon: float, lat: float, geometry: dict) -> bool:
    if geometry["type"] == "Polygon":
        rings = geometry["coordinates"]
    elif geometry["type"] == "MultiPolygon":
        rings = [ring for poly in geometry["coordinates"] for ring in poly]
    else:
        return False
    if not rings:
        return False
    if not _point_in_ring(lon, lat, rings[0]):
        return False
    for hole in rings[1:]:
        if _point_in_ring(lon, lat, hole):
            return False
    return True


def _bbox(geometry: dict) -> tuple[float, float, float, float]:
    if geometry["type"] == "Polygon":
        coords = [pt for ring in geometry["coordinates"] for pt in ring]
    else:
        coords = [pt for poly in geometry["coordinates"] for ring in poly for pt in ring]
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    return min(lons), min(lats), max(lons), max(lats)


def random_point_in_commune(commune_id: str, fallback_lat: float, fallback_lon: float) -> tuple[float, float]:
    """Returns (lat, lon). Falls back to the commune's known centroid if the
    polygon is missing or sampling doesn't converge (tiny/degenerate shapes)."""
    geometry = _POLYGON_BY_COMMUNE_ID.get(commune_id)
    if geometry is None:
        return fallback_lat, fallback_lon
    min_lon, min_lat, max_lon, max_lat = _bbox(geometry)
    for _ in range(200):
        lon = random.uniform(min_lon, max_lon)
        lat = random.uniform(min_lat, max_lat)
        if _point_in_polygon(lon, lat, geometry):
            return lat, lon
    return fallback_lat, fallback_lon
